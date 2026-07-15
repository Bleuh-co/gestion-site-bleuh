// Types partagés du module Assistant (console d'admin du bot public bleuh-chat).
// Porté depuis Apps/Formulaire DB-Products-Master/public/assistant.js.

export interface FaqItem {
  q_fr: string;
  a_fr: string;
  q_en: string;
  a_en: string;
}

export interface AssistantConfig {
  enabled: boolean;
  model: string;
  identity_fr: string;
  identity_en: string;
  tone_fr: string;
  tone_en: string;
  starters_fr: string[];
  starters_en: string[];
  faq: FaqItem[];
  escalationEmail: string;
  dailyBudgetUsd?: number;
  maxMessagesPerSession?: number;
  maxRequestsPerHourPerIp?: number;
  maxInputChars?: number;
  maxOutputTokens?: number;
  version?: number;
  updatedBy?: string;
  updatedAt?: string;
}

export const EMPTY_CONFIG: AssistantConfig = {
  enabled: true,
  model: "claude-haiku-4-5",
  identity_fr: "",
  identity_en: "",
  tone_fr: "",
  tone_en: "",
  starters_fr: [],
  starters_en: [],
  faq: [],
  escalationEmail: "",
  version: 0,
};

export interface LegalCore {
  fr: string;
  en: string;
}

export interface SandboxMessage {
  role: "user" | "assistant";
  content: string;
}

export interface SelftestDetail {
  id: string;
  ok: boolean;
  extrait?: string;
  raisons?: string[];
}

export interface SelftestReport {
  passed: number;
  failed: number;
  total: number;
  details: SelftestDetail[];
}

export interface StatsDay {
  date: string;
  requests: number;
  costUsd: number;
}

export interface StatsResponse {
  days: StatsDay[];
  todayCostUsd: number;
  escalation: { escalated: number; total: number; rate: number };
}

export interface TranscriptMessage {
  role: "user" | "assistant";
  content: string;
}

export interface Transcript {
  updatedAt: string;
  locale: string;
  region: string;
  outcome: string;
  messages: TranscriptMessage[];
}

export type ResultBanner = { ok: boolean; message: string } | null;

/** Résultat JSON générique renvoyé par un proxy /api/assistant/* en erreur. */
export interface ProxyErrorPayload {
  error?: string;
  message?: string;
}

export async function readApiError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as ProxyErrorPayload;
    return data.error || data.message || `Erreur ${res.status}`;
  } catch {
    return `Erreur ${res.status}`;
  }
}
