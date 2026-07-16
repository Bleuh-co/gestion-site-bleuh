// ───────────────────────────────────────────────────────────
// Types métier — module Infolettre (MailerLite Bleuh)
// Porté depuis gestionnaire-donnees-mailerlite (src/lib/types.ts),
// scopé Bleuh-only. Aucune clé API n'apparaît ici.
// ───────────────────────────────────────────────────────────

export interface MailerLiteAccount {
  id: string;
  label: string; // nom interne du compte (« Bleuh »)
  apiKeyMasked: string; // 4 derniers caractères seulement
  configured: boolean; // false si MAILERLITE_BLEUH_API_KEY absent
  createdAt: string; // ISO
  lastSyncAt?: string; // ISO
  subscriberCount?: number;
}

export type SubscriberStatus =
  | "active"
  | "unsubscribed"
  | "unconfirmed"
  | "bounced"
  | "junk";

export interface Subscriber {
  id: string;
  email: string;
  status: SubscriberStatus;
  source?: string;
  fields: Record<string, string | number | null>;
  groups: string[]; // ids des groupes
  subscribedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Campaign {
  id: string;
  name: string;
  subject: string;
  type: string; // "regular" | "followup" | "ab"
  dateSend: string; // "YYYY-MM-DD HH:MM:SS" (tel quel) ou ISO
  dateCreated: string;
  recipients: number;
  openCount: number;
  openRate: number; // %
  clickCount: number;
  clickRate: number; // %
}

export interface CampaignsResult {
  data: Campaign[];
  hasMore: boolean;
  nextOffset: number;
}

export interface CampaignsSummary {
  campaigns: number;
  totalRecipients: number;
  avgOpenRate: number; // % pondéré
  avgClickRate: number; // % pondéré
}

export interface CampaignsResponse {
  summary: CampaignsSummary;
  campaigns: Campaign[];
}

export interface MLGroup {
  id: string;
  name: string;
  activeCount: number;
  total: number;
}

export interface MLField {
  id: string;
  key: string;
  name: string;
  type: "text" | "number" | "date";
}

// Statut du snapshot — reprend le flux source (pending → running → done|failed)
export type SnapshotStatus = "pending" | "running" | "done" | "failed";

export interface SnapshotDoc {
  id: string;
  accountId: string;
  accountLabel: string;
  label: string;
  status: SnapshotStatus;
  scope: "all" | "group";
  groupId?: string;
  groupName?: string;
  totalSubscribers: number;
  fetchedSubscribers: number;
  fields: MLField[];
  errorMessage?: string;
  gcsPath?: string; // chemin du fichier JSON dans GCS
  createdAt: string; // ISO
  completedAt?: string; // ISO
  createdByEmail: string;
}

export type ExportFormat = "csv" | "json";

export interface SubscriberQuery {
  search?: string;
  status?: SubscriberStatus;
  groupId?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
