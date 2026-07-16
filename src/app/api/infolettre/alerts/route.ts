import { NextResponse } from "next/server";
import { requireRead } from "@/lib/auth-server";
import { adminDb } from "@/lib/firebase-admin";
import { handleError } from "@/lib/products-service";
import {
  METRICS_COLLECTION,
  CAMPAIGN_STATS_COLLECTION,
} from "@/lib/infolettre-collect";
import type {
  MetricsSnapshot,
  CampaignStatHistory,
} from "@/lib/infolettre-metrics-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ── Seuils (tous explicites, aucun nombre magique caché) ──────────────
//
// Fenêtre "récente" pour juger une campagne : on retient les campagnes
// envoyées dans les 60 derniers jours, et si trop peu, on complète jusqu'à
// atteindre au moins RECENT_MIN campagnes (les plus récentes par date d'envoi).
const RECENT_DAYS = 60;
const RECENT_MIN = 20;
// Une campagne récente est "sous-performante" si son taux d'ouverture est
// sous 70 % de la moyenne pondérée globale (écart net, pas un simple bruit).
const UNDERPERFORM_RATIO = 0.7;
// On ne juge la performance qu'à partir d'un envoi réel (bruit statistique
// ingérable sous ce seuil de destinataires).
const MIN_RECIPIENTS = 100;
// Baisse d'abonnés ACTIFS entre les 2 derniers points, en proportion du
// point précédent, au-delà de laquelle on alerte "liste qui rétrécit".
// 0.5 % = fluctuation dépassant le simple va-et-vient d'inscriptions.
const SHRINK_RATIO = 0.005;
// Hausse des désabonnés entre les 2 derniers points, en proportion du
// nombre d'actifs précédent, au-delà de laquelle on alerte "pic de désabo".
const UNSUB_SPIKE_RATIO = 0.005;

type Severity = "info" | "warning" | "critical";

interface Alert {
  id: string;
  type: "campaign_underperform" | "list_shrinking" | "unsub_spike";
  severity: Severity;
  title: string;
  detail: string;
  metric?: Record<string, number | string>;
}

interface AlertsResponse {
  alerts: Alert[];
  generatedAt: string;
  hasData: boolean;
}

/** "YYYY-MM-DD HH:MM:SS" (heure du compte) → Date. Tolère déjà-ISO. */
function parseDateSend(s: string): Date | null {
  if (!s) return null;
  const d = new Date(s.includes("T") ? s : s.replace(" ", "T"));
  return isNaN(d.getTime()) ? null : d;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

interface CampaignRow {
  name: string;
  dateSend: Date;
  recipients: number;
  openRate: number;
}

// GET /api/infolettre/alerts → alertes déterministes du tableau de bord. requireRead.
export async function GET() {
  try {
    await requireRead();
    const db = adminDb();

    const [metricsSnap, statsSnap] = await Promise.all([
      db.collection(METRICS_COLLECTION).orderBy("capturedAt", "asc").get(),
      db.collection(CAMPAIGN_STATS_COLLECTION).get(),
    ]);

    const snapshots = metricsSnap.docs.map((d) => d.data() as MetricsSnapshot);

    // ── Campagnes : dernier point d'history = stats finales ──────────
    const rows: CampaignRow[] = [];
    for (const doc of statsSnap.docs) {
      const c = doc.data() as CampaignStatHistory;
      const d = parseDateSend(c.dateSend);
      if (!d) continue;
      const final = c.history?.[c.history.length - 1];
      rows.push({
        name: c.name || c.subject || c.campaignId,
        dateSend: d,
        recipients: c.recipients ?? 0,
        openRate: final?.openRate ?? 0,
      });
    }
    rows.sort((a, b) => b.dateSend.getTime() - a.dateSend.getTime());

    const hasData = rows.length > 0 || snapshots.length > 0;
    const alerts: Alert[] = [];

    // ── 1. Campagnes récentes sous-performantes ─────────────────────
    // Base statistiquement fiable : uniquement les envois >= MIN_RECIPIENTS.
    const sizable = rows.filter((r) => r.recipients >= MIN_RECIPIENTS);
    // Moyenne pondérée par destinataires sur TOUTE l'histoire fiable
    // (référence stable, non biaisée par un mois faible).
    let num = 0;
    let den = 0;
    for (const r of sizable) {
      num += r.openRate * r.recipients;
      den += r.recipients;
    }
    const avgOpenRate = den > 0 ? num / den : 0;

    if (den > 0) {
      // Sélection "récente" : 60 derniers jours, complétée jusqu'à RECENT_MIN.
      const cutoff = Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000;
      const byDateDesc = [...sizable]; // déjà trié récent → ancien
      const recentWindow = byDateDesc.filter(
        (r) => r.dateSend.getTime() >= cutoff
      );
      const recent =
        recentWindow.length >= RECENT_MIN
          ? recentWindow
          : byDateDesc.slice(0, RECENT_MIN);

      const threshold = avgOpenRate * UNDERPERFORM_RATIO;
      for (const r of recent) {
        if (r.openRate < threshold) {
          // Sévérité selon l'ampleur de l'écart : moins de la moitié de la
          // moyenne = critique, sinon warning.
          const severity: Severity =
            r.openRate < avgOpenRate * 0.5 ? "critical" : "warning";
          alerts.push({
            id: `campaign_underperform:${r.name}:${r.dateSend.toISOString()}`,
            type: "campaign_underperform",
            severity,
            title: `Campagne sous la moyenne : ${r.name}`,
            detail: `${round1(r.openRate)} % d'ouverture contre une moyenne de ${round1(
              avgOpenRate
            )} % (seuil d'alerte : ${round1(threshold)} %).`,
            metric: {
              openRate: round1(r.openRate),
              avgOpenRate: round1(avgOpenRate),
            },
          });
        }
      }
    }

    // ── 2. Liste qui rétrécit / 3. Pic de désabonnements ────────────
    // Honnête : sans 2 points de metrics, on ne peut RIEN dire → pas d'alerte.
    if (snapshots.length >= 2) {
      const prev = snapshots[snapshots.length - 2];
      const last = snapshots[snapshots.length - 1];
      const prevActive = prev.subscribers?.active ?? 0;
      const lastActive = last.subscribers?.active ?? 0;
      const prevUnsub = prev.subscribers?.unsubscribed ?? 0;
      const lastUnsub = last.subscribers?.unsubscribed ?? 0;

      // Liste qui rétrécit : baisse nette des actifs (> SHRINK_RATIO).
      if (prevActive > 0 && lastActive < prevActive) {
        const drop = prevActive - lastActive;
        const dropRatio = drop / prevActive;
        if (dropRatio > SHRINK_RATIO) {
          alerts.push({
            id: `list_shrinking:${last.capturedAt}`,
            type: "list_shrinking",
            severity: dropRatio > SHRINK_RATIO * 4 ? "critical" : "warning",
            title: "La liste rétrécit",
            detail: `${drop.toLocaleString("fr-CA")} abonnés actifs de moins depuis la dernière capture (${round1(
              dropRatio * 100
            )} %).`,
            metric: {
              active: lastActive,
              previousActive: prevActive,
              dropPct: round1(dropRatio * 100),
            },
          });
        }
      }

      // Pic de désabonnements : hausse de `unsubscribed` rapportée aux actifs.
      if (lastUnsub > prevUnsub && prevActive > 0) {
        const spike = lastUnsub - prevUnsub;
        const spikeRatio = spike / prevActive;
        if (spikeRatio > UNSUB_SPIKE_RATIO) {
          alerts.push({
            id: `unsub_spike:${last.capturedAt}`,
            type: "unsub_spike",
            severity: spikeRatio > UNSUB_SPIKE_RATIO * 4 ? "critical" : "warning",
            title: "Pic de désabonnements",
            detail: `${spike.toLocaleString("fr-CA")} nouveaux désabonnements depuis la dernière capture (${round1(
              spikeRatio * 100
            )} % des actifs).`,
            metric: {
              unsubscribed: lastUnsub,
              previousUnsubscribed: prevUnsub,
              spikePct: round1(spikeRatio * 100),
            },
          });
        }
      }
    }

    // Tri d'affichage : critique d'abord, puis warning, puis info.
    const order: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };
    alerts.sort((a, b) => order[a.severity] - order[b.severity]);

    const body: AlertsResponse = {
      alerts,
      generatedAt: new Date().toISOString(),
      hasData,
    };
    return NextResponse.json(body);
  } catch (error) {
    return handleError(error, "GET /api/infolettre/alerts");
  }
}
