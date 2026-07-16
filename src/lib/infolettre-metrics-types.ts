/**
 * Types du suivi historique MailerLite (fondation des séries temporelles).
 *
 * Deux collections Firestore alimentées par le collecteur
 * (`src/lib/infolettre-collect.ts`) :
 *  - `infolettre_metrics/{ISO-créneau}`     → MetricsSnapshot (état du compte)
 *  - `infolettre_campaign_stats/{campaignId}` → CampaignStatHistory (série par campagne)
 *
 * Les briques Tendances / IA / Alertes viendront LIRE ces docs (phases suivantes).
 */

/** Un point d'historique de performance d'une campagne. */
export interface CampaignStatPoint {
  capturedAt: string; // ISO
  openCount: number;
  openRate: number; // %
  clickCount: number;
  clickRate: number; // %
}

/** État du groupe au moment de la capture. */
export interface SnapshotGroup {
  groupId: string;
  name: string;
  active: number;
  total: number;
}

/**
 * Cliché de l'état du compte à un instant donné.
 * Doc `infolettre_metrics/{ISO-créneau}` (créneau arrondi à 6h → idempotent).
 */
export interface MetricsSnapshot {
  capturedAt: string; // ISO — horodatage réel de la capture
  subscribers: {
    total: number;
    active: number; // = subscribed
    unsubscribed: number;
  };
  byGroup: SnapshotGroup[];
  campaignsSent: number; // nb de campagnes envoyées connues au moment de la capture
}

/**
 * Historique de performance d'une campagne dans le temps.
 * Doc `infolettre_campaign_stats/{campaignId}`.
 */
export interface CampaignStatHistory {
  campaignId: string;
  name: string;
  subject: string;
  type: string;
  dateSend: string;
  recipients: number;
  history: CampaignStatPoint[]; // borné (~40 points), plus récents gardés
}

/** Résumé retourné par collectSnapshot(). */
export interface CollectSummary {
  metricsWritten: boolean;
  campaignsUpserted: number;
  historyPointsAdded: number;
}
