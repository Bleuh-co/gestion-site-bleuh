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

/** Un point de la série santé de liste (léger, prêt à tracer). */
interface MetricsSeriesPoint {
  capturedAt: string;
  total: number;
  active: number;
  unsubscribed: number;
}

/** Ventilation d'un groupe + croissance depuis le 1er point connu. */
interface GroupBreakdown {
  groupId: string;
  name: string;
  active: number;
  total: number;
  growth: number | null; // Δ actifs depuis le 1er snapshot (null si <2 points)
}

/** Un envoi = dernier point d'history projeté sur sa date d'envoi. */
interface CampaignPoint {
  dateSend: string; // ISO
  name: string;
  recipients: number;
  openRate: number;
  clickRate: number;
}

/** Agrégat mensuel pondéré par destinataires. */
interface MonthlyAggregate {
  month: string; // 'YYYY-MM'
  campaigns: number;
  recipients: number;
  avgOpenRate: number;
  avgClickRate: number;
}

interface TrendsResponse {
  metricsSeries: MetricsSeriesPoint[];
  byGroup: GroupBreakdown[];
  campaignPoints: CampaignPoint[];
  monthly: MonthlyAggregate[];
}

/** "YYYY-MM-DD HH:MM:SS" (heure du compte) → ISO. Tolère déjà-ISO. */
function parseDateSend(s: string): Date | null {
  if (!s) return null;
  const d = new Date(s.includes("T") ? s : s.replace(" ", "T"));
  return isNaN(d.getTime()) ? null : d;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// GET /api/infolettre/trends → séries prêtes à visualiser. requireRead.
export async function GET() {
  try {
    await requireRead();
    const db = adminDb();

    const [metricsSnap, statsSnap] = await Promise.all([
      db.collection(METRICS_COLLECTION).orderBy("capturedAt", "asc").get(),
      db.collection(CAMPAIGN_STATS_COLLECTION).get(),
    ]);

    // ── Série santé de liste ────────────────────────────────
    const snapshots = metricsSnap.docs.map((d) => d.data() as MetricsSnapshot);
    const metricsSeries: MetricsSeriesPoint[] = snapshots.map((s) => ({
      capturedAt: s.capturedAt,
      total: s.subscribers?.total ?? 0,
      active: s.subscribers?.active ?? 0,
      unsubscribed: s.subscribers?.unsubscribed ?? 0,
    }));

    // Ventilation actuelle (dernier snapshot) + croissance par groupe.
    const last = snapshots[snapshots.length - 1];
    const first = snapshots[0];
    const firstByGroup = new Map<string, number>();
    if (snapshots.length >= 2 && first) {
      for (const g of first.byGroup ?? []) firstByGroup.set(g.groupId, g.active);
    }
    const byGroup: GroupBreakdown[] = (last?.byGroup ?? [])
      .map((g) => ({
        groupId: g.groupId,
        name: g.name,
        active: g.active,
        total: g.total,
        growth:
          snapshots.length >= 2 && firstByGroup.has(g.groupId)
            ? g.active - (firstByGroup.get(g.groupId) as number)
            : null,
      }))
      .sort((a, b) => b.active - a.active);

    // ── Campagnes : dernier point d'history = stats finales ──
    const campaignPoints: CampaignPoint[] = [];
    for (const doc of statsSnap.docs) {
      const c = doc.data() as CampaignStatHistory;
      const d = parseDateSend(c.dateSend);
      if (!d) continue;
      const finalPoint = c.history?.[c.history.length - 1];
      campaignPoints.push({
        dateSend: d.toISOString(),
        name: c.name || c.subject || c.campaignId,
        recipients: c.recipients ?? 0,
        openRate: finalPoint?.openRate ?? 0,
        clickRate: finalPoint?.clickRate ?? 0,
      });
    }
    campaignPoints.sort((a, b) => a.dateSend.localeCompare(b.dateSend));

    // ── Agrégats mensuels (moyennes pondérées par destinataires) ─
    const monthMap = new Map<
      string,
      { campaigns: number; recipients: number; openW: number; clickW: number }
    >();
    for (const p of campaignPoints) {
      const month = p.dateSend.slice(0, 7); // 'YYYY-MM'
      const m =
        monthMap.get(month) ??
        { campaigns: 0, recipients: 0, openW: 0, clickW: 0 };
      m.campaigns += 1;
      m.recipients += p.recipients;
      m.openW += p.openRate * p.recipients;
      m.clickW += p.clickRate * p.recipients;
      monthMap.set(month, m);
    }
    const monthly: MonthlyAggregate[] = [...monthMap.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, m]) => ({
        month,
        campaigns: m.campaigns,
        recipients: m.recipients,
        avgOpenRate: m.recipients > 0 ? round1(m.openW / m.recipients) : 0,
        avgClickRate: m.recipients > 0 ? round1(m.clickW / m.recipients) : 0,
      }));

    const body: TrendsResponse = {
      metricsSeries,
      byGroup,
      campaignPoints,
      monthly,
    };
    return NextResponse.json(body);
  } catch (error) {
    return handleError(error, "GET /api/infolettre/trends");
  }
}
