import "server-only";
import { Timestamp } from "firebase-admin/firestore";
import { chatDb } from "./firebase-admin";

// ─────────────────────────────────────────────────────────────
// Analyse CEO — KPIs réels dérivés du bot Bleuh (bleuh-chat).
//
// Aucune nouvelle instrumentation : on lit les collections déjà écrites par
// bleuh-chat/lib/chat.js et lib/limits.js (`chat_usage`, `chat_sessions`,
// `chat_config`). Dépôts séparés → petites constantes dupliquées (pricing).
// Voir brief « Module Analyse CEO » (pivot vs Antigravity.md, obsolète).
// ─────────────────────────────────────────────────────────────

export type CeoPeriod = "7d" | "30d" | "90d";

const PERIOD_DAYS: Record<CeoPeriod, number> = { "7d": 7, "30d": 30, "90d": 90 };

export function normalizePeriod(value: string | null): CeoPeriod {
  return value === "30d" || value === "90d" ? value : "7d";
}

// Table de tarification dupliquée depuis bleuh-chat/lib/limits.js
// (MODEL_PRICING) — USD par million de tokens. Dépôts séparés, pas de
// package partagé.
const MODEL_PRICING: Record<string, { in: number; out: number }> = {
  "claude-haiku-4-5": { in: 1, out: 5 },
  "claude-sonnet-4-6": { in: 3, out: 15 },
};
// Défaut sûr si le modèle est inconnu/absent : tarif le plus cher (Sonnet),
// même logique de défaut que lib/limits.js (surestimer plutôt que sous-estimer).
const DEFAULT_PRICING = MODEL_PRICING["claude-sonnet-4-6"];

function pricingFor(model: string | null | undefined) {
  return (model && MODEL_PRICING[model]) || DEFAULT_PRICING;
}

function estimateCostUsd(inputTokens: number, outputTokens: number, model: string | null | undefined) {
  const pricing = pricingFor(model);
  return (inputTokens / 1e6) * pricing.in + (outputTokens / 1e6) * pricing.out;
}

/** Format YYYY-MM-DD (UTC), même format que dayKey() de bleuh-chat/lib/limits.js. */
function utcDateStr(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Liste des N derniers jours (UTC), du plus ancien au plus récent, aujourd'hui inclus. */
function lastNDaysUtc(n: number): string[] {
  const now = new Date();
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    d.setUTCDate(d.getUTCDate() - i);
    out.push(utcDateStr(d));
  }
  return out;
}

export interface DailyPoint {
  date: string;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export interface CeoKpis {
  period: CeoPeriod;
  days: number;
  model: string; // modèle courant utilisé pour le calcul du coût (chat_config/current.model)
  interactions: {
    total: number;
    byDay: DailyPoint[];
  };
  cost: {
    totalUsd: number;
    label: string; // "estimé (modèle courant)" — cf. limite honnête du brief §1.2
  };
  sessions: {
    total: number;
    escalated: number;
    escalationRate: number | null; // null si total === 0 (pas de 0% trompeur)
  };
}

export interface CeoSources {
  ga4: "non_instrumente";
  ventes: "non_instrumente";
}

export interface CeoAnalysisResult {
  generatedAt: string;
  period: CeoPeriod;
  kpis: CeoKpis;
  sources: CeoSources;
  aiSummary: string | null;
}

/**
 * Modèle courant du bot (chat_config/current.model), utilisé uniquement pour
 * estimer le coût du jour. Défaut sûr (tarif le plus cher) si le document
 * est absent/illisible — jamais de crash.
 */
async function getCurrentModel(): Promise<string> {
  try {
    const snap = await chatDb().collection("chat_config").doc("current").get();
    const model = snap.exists ? (snap.data()?.model as string | undefined) : undefined;
    return typeof model === "string" && model.trim() ? model : "claude-haiku-4-5";
  } catch (e) {
    console.warn("[ceo-analysis] chat_config/current illisible, défaut appliqué :", e);
    return "claude-haiku-4-5";
  }
}

/**
 * Volume d'interactions + coût IA estimé sur N jours, depuis
 * chat_usage/day_{YYYY-MM-DD}. Lectures par id connu (Promise.all), jamais de
 * `where`. Chaque échec individuel de lecture retombe sur un jour à 0 plutôt
 * que de faire échouer l'ensemble.
 */
async function getInteractionsAndCost(dates: string[], model: string): Promise<DailyPoint[]> {
  const col = chatDb().collection("chat_usage");
  const results = await Promise.all(
    dates.map(async (date): Promise<DailyPoint> => {
      try {
        const snap = await col.doc(`day_${date}`).get();
        const data = snap.exists ? snap.data() || {} : {};
        const requests = Number(data.requests) || 0;
        const inputTokens = Number(data.inputTokens) || 0;
        const outputTokens = Number(data.outputTokens) || 0;
        return {
          date,
          requests,
          inputTokens,
          outputTokens,
          costUsd: estimateCostUsd(inputTokens, outputTokens, model),
        };
      } catch (e) {
        console.warn(`[ceo-analysis] lecture chat_usage/day_${date} échouée :`, e);
        return { date, requests: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 };
      }
    })
  );
  return results;
}

/**
 * Nombre de sessions et taux d'escalade sur la fenêtre, depuis
 * `chat_sessions` (updatedAt >= début de fenêtre). En cas d'échec (index
 * composite manquant, Firestore injoignable...), retombe sur des KPIs à 0
 * plutôt que de faire planter la route.
 */
async function getSessionsKpis(startDate: Date): Promise<{ total: number; escalated: number }> {
  try {
    const snap = await chatDb()
      .collection("chat_sessions")
      .where("updatedAt", ">=", Timestamp.fromDate(startDate))
      .get();
    const total = snap.size;
    const escalated = snap.docs.filter((d) => d.data().outcome === "escalated").length;
    return { total, escalated };
  } catch (e) {
    console.warn("[ceo-analysis] lecture chat_sessions échouée :", e);
    return { total: 0, escalated: 0 };
  }
}

export async function buildCeoKpis(period: CeoPeriod): Promise<CeoKpis> {
  const days = PERIOD_DAYS[period];
  const dates = lastNDaysUtc(days);
  const model = await getCurrentModel();

  const now = new Date();
  const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  const [byDay, sessionsRaw] = await Promise.all([
    getInteractionsAndCost(dates, model),
    getSessionsKpis(startDate),
  ]);

  const totalRequests = byDay.reduce((sum, d) => sum + d.requests, 0);
  const totalCostUsd = byDay.reduce((sum, d) => sum + d.costUsd, 0);
  const escalationRate = sessionsRaw.total > 0 ? sessionsRaw.escalated / sessionsRaw.total : null;

  return {
    period,
    days,
    model,
    interactions: { total: totalRequests, byDay },
    cost: { totalUsd: totalCostUsd, label: "estimé (modèle courant)" },
    sessions: {
      total: sessionsRaw.total,
      escalated: sessionsRaw.escalated,
      escalationRate,
    },
  };
}

// ─────────────────────────────────────────────────────────────
// Synthèse IA — dégradation propre sans clé Anthropic (brief §3).
// Ne reçoit QUE les KPIs déjà calculés (jamais de transcript brut) et une
// consigne système contraignant le modèle à ne commenter que ces métriques.
// ─────────────────────────────────────────────────────────────

const AI_SYSTEM_PROMPT = `Tu es un analyste qui résume des indicateurs internes d'un chatbot support (Bleuh) pour un CEO.
Règles strictes :
- Ne commente QUE les métriques fournies dans le message utilisateur. N'invente aucun chiffre.
- N'établis JAMAIS de lien entre le volume de chat et des ventes, un trafic ou une conversion : ces données ne sont pas connectées à ce module.
- Si les métriques suggèrent des sujets récurrents ou toute observation qui n'est pas un chiffre compté directement, qualifie-la explicitement d'estimation.
- Réponds en français, en 3 à 5 puces courtes et factuelles (une ligne chacune, préfixée par "- "), sans préambule ni conclusion.`;

async function callAiSummary(kpis: CeoKpis): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey });

    const userPayload = {
      periode: kpis.period,
      volumeInteractions: kpis.interactions.total,
      coutIaEstimeUsd: Number(kpis.cost.totalUsd.toFixed(2)),
      modeleCourant: kpis.model,
      nombreSessions: kpis.sessions.total,
      sessionsEscaladees: kpis.sessions.escalated,
      tauxEscalade:
        kpis.sessions.escalationRate === null
          ? "n/a (aucune session sur la période)"
          : `${(kpis.sessions.escalationRate * 100).toFixed(1)}%`,
    };

    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 512,
      system: AI_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Voici les KPIs du bot Bleuh sur la période ${kpis.period} :\n${JSON.stringify(userPayload, null, 2)}`,
        },
      ],
    });

    const text = response.content
      .filter((block): block is { type: "text"; text: string } => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();

    return text || null;
  } catch (e) {
    console.warn("[ceo-analysis] appel Anthropic échoué :", e);
    return null;
  }
}

export async function buildCeoAnalysis(period: CeoPeriod): Promise<CeoAnalysisResult> {
  const kpis = await buildCeoKpis(period);
  const aiSummary = await callAiSummary(kpis);

  return {
    generatedAt: new Date().toISOString(),
    period,
    kpis,
    sources: { ga4: "non_instrumente", ventes: "non_instrumente" },
    aiSummary,
  };
}
