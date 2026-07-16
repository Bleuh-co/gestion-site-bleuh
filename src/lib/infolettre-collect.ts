import "server-only";
import { adminDb } from "./firebase-admin";
import { getBleuhClient } from "./mailerlite-bleuh";
import type { Campaign } from "./infolettre-types";
import type {
  CampaignStatHistory,
  CampaignStatPoint,
  CollectSummary,
  MetricsSnapshot,
  SnapshotGroup,
} from "./infolettre-metrics-types";

export const METRICS_COLLECTION = "infolettre_metrics";
export const CAMPAIGN_STATS_COLLECTION = "infolettre_campaign_stats";

const SLOT_MS = 6 * 60 * 60 * 1000; // créneau d'idempotence : 6h
const MAX_HISTORY_POINTS = 40; // borne de l'historique par campagne

/**
 * Identifiant de doc du snapshot : horodatage arrondi (floor) au créneau 6h,
 * en ISO. Deux appels dans le même créneau visent le MÊME doc → pas de doublon.
 */
export function snapshotSlotId(now: Date = new Date()): string {
  const floored = Math.floor(now.getTime() / SLOT_MS) * SLOT_MS;
  return new Date(floored).toISOString();
}

/** Deux points ont-ils des chiffres identiques (→ pas d'ajout d'historique) ? */
function samePoint(a: CampaignStatPoint, b: Omit<CampaignStatPoint, "capturedAt">): boolean {
  return (
    a.openCount === b.openCount &&
    a.openRate === b.openRate &&
    a.clickCount === b.clickCount &&
    a.clickRate === b.clickRate
  );
}

/**
 * Capture et STOCKE l'état MailerLite courant (server only).
 *
 * a. compte + groupes → doc `infolettre_metrics/{ISO-créneau}` (idempotent 6h)
 * b. campagnes envoyées → upsert `infolettre_campaign_stats/{campaignId}`,
 *    append d'un point d'historique UNIQUEMENT si les chiffres ont bougé.
 */
export async function collectSnapshot(): Promise<CollectSummary> {
  const client = getBleuhClient();
  if (!client) throw new Error("MailerLite Bleuh non configuré.");

  const db = adminDb();
  const capturedAt = new Date().toISOString();

  // ── a. Snapshot compte + groupes ─────────────────────────────
  const [stats, groups] = await Promise.all([client.getAccountStats(), client.getGroups()]);

  const byGroup: SnapshotGroup[] = groups.map((g) => ({
    groupId: g.id,
    name: g.name,
    active: g.activeCount,
    total: g.total,
  }));

  // ── b. Campagnes envoyées (toutes, dédupliquées par id) ──────
  const campaigns: Campaign[] = await client.getAllSentCampaigns();

  const snapshot: MetricsSnapshot = {
    capturedAt,
    subscribers: {
      total: stats.total,
      active: stats.subscribed,
      unsubscribed: stats.unsubscribed,
    },
    byGroup,
    campaignsSent: campaigns.length,
  };

  // Écriture du snapshot — set() sur l'id de créneau : ré-appel dans le même
  // créneau = écrasement propre (pas de doc en double).
  await db.collection(METRICS_COLLECTION).doc(snapshotSlotId(new Date(capturedAt))).set(snapshot);

  // Upsert des historiques de campagne.
  let campaignsUpserted = 0;
  let historyPointsAdded = 0;

  for (const c of campaigns) {
    const ref = db.collection(CAMPAIGN_STATS_COLLECTION).doc(c.id);
    const snap = await ref.get();
    const point: CampaignStatPoint = {
      capturedAt,
      openCount: c.openCount,
      openRate: c.openRate,
      clickCount: c.clickCount,
      clickRate: c.clickRate,
    };

    if (!snap.exists) {
      const doc: CampaignStatHistory = {
        campaignId: c.id,
        name: c.name,
        subject: c.subject,
        type: c.type,
        dateSend: c.dateSend,
        recipients: c.recipients,
        history: [point],
      };
      await ref.set(doc);
      campaignsUpserted += 1;
      historyPointsAdded += 1;
      continue;
    }

    const existing = snap.data() as CampaignStatHistory;
    const history = Array.isArray(existing.history) ? existing.history : [];
    const last = history[history.length - 1];

    // Métadonnées rafraîchies (mais on ne touche pas l'historique si figé).
    const meta = {
      name: c.name,
      subject: c.subject,
      type: c.type,
      dateSend: c.dateSend,
      recipients: c.recipients,
    };

    if (last && samePoint(last, point)) {
      await ref.set(meta, { merge: true });
      campaignsUpserted += 1;
      continue;
    }

    const nextHistory = [...history, point].slice(-MAX_HISTORY_POINTS);
    await ref.set({ ...meta, history: nextHistory }, { merge: true });
    campaignsUpserted += 1;
    historyPointsAdded += 1;
  }

  return { metricsWritten: true, campaignsUpserted, historyPointsAdded };
}
