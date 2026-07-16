import "server-only";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb, chatDb } from "./firebase-admin";
import { PRODUCTS_COLLECTION } from "./products-service";

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

// Taux indicatif, ajustable — pas de conversion live (pas de dépendance
// externe pour un module de reporting interne). À revoir périodiquement.
const USD_TO_CAD = 1.38;

function pricingFor(model: string | null | undefined) {
  return (model && MODEL_PRICING[model]) || DEFAULT_PRICING;
}

function estimateCostCad(inputTokens: number, outputTokens: number, model: string | null | undefined) {
  const pricing = pricingFor(model);
  const usd = (inputTokens / 1e6) * pricing.in + (outputTokens / 1e6) * pricing.out;
  return usd * USD_TO_CAD;
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
  costCad: number;
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
    totalCad: number;
    label: string; // "estimé (modèle courant)" — cf. limite honnête du brief §1.2
  };
  sessions: {
    total: number;
    escalated: number;
    escalationRate: number | null; // null si total === 0 (pas de 0% trompeur)
  };
}

export interface Ga4TrafficOk {
  status: "ok";
  sessions: number;
  activeUsers: number;
  screenPageViews: number;
}

export interface Ga4TrafficNonInstrumente {
  status: "non_instrumente";
}

export type Ga4Traffic = Ga4TrafficOk | Ga4TrafficNonInstrumente;

export interface Ga4EventsOk {
  status: "ok";
  /** Clics vers un détaillant (SQDC/OCS) — LA conversion du site vitrine. */
  selectRetailer: number;
  /** Vues de fiches produit, si l'événement simple `view_item` est câblé. */
  viewItem: number;
}

export interface Ga4EventsNonInstrumente {
  status: "non_instrumente";
}

export type Ga4Events = Ga4EventsOk | Ga4EventsNonInstrumente;

export interface CatalogPresenceOk {
  status: "ok";
  skus: number;
  collections: number;
  provinces: string[];
}

export interface CatalogPresenceNonInstrumente {
  status: "non_instrumente";
}

export type CatalogPresence = CatalogPresenceOk | CatalogPresenceNonInstrumente;

export interface CeoSources {
  ga4: Ga4Traffic;
  ga4Events: Ga4Events;
  catalogue: CatalogPresence;
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
          costCad: estimateCostCad(inputTokens, outputTokens, model),
        };
      } catch (e) {
        console.warn(`[ceo-analysis] lecture chat_usage/day_${date} échouée :`, e);
        return { date, requests: 0, inputTokens: 0, outputTokens: 0, costCad: 0 };
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
  const totalCostCad = byDay.reduce((sum, d) => sum + d.costCad, 0);
  const escalationRate = sessionsRaw.total > 0 ? sessionsRaw.escalated / sessionsRaw.total : null;

  return {
    period,
    days,
    model,
    interactions: { total: totalRequests, byDay },
    cost: { totalCad: totalCostCad, label: "estimé (modèle courant)" },
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

const AI_SYSTEM_PROMPT = `Tu es un analyste qui résume des indicateurs internes pour le CEO de Bleuh.
Contexte métier impératif : bleuh.co est un site VITRINE/catalogue, PAS un site de vente. Bleuh vend en gros aux détaillants provinciaux (SQDC au Québec, OCS en Ontario) ; le site sert à faire découvrir les produits et à rediriger l'acheteur vers ces détaillants. Le signal de conversion du site est le CLIC vers un détaillant (événement GA4 select_retailer) — il n'existe aucune notion de vente, revenu ou chiffre d'affaires directement sur le site.
Règles strictes :
- Ne commente QUE les métriques fournies dans le message utilisateur. N'invente aucun chiffre.
- INTERDICTION ABSOLUE d'employer ou de suggérer les mots « ventes », « revenus », « chiffre d'affaires », « sell-through » ou toute notion équivalente : ce module ne les mesure pas et ne doit jamais laisser croire que le site vend directement.
- N'établis JAMAIS de lien de causalité entre le volume de chat et le trafic ou les clics détaillants : ces données ne sont pas connectées entre elles dans ce module.
- Le signal « catalogue » (SKUs en marché, collections, provinces) est une donnée réelle distincte, lue directement dans le catalogue produits. Tu peux la citer telle quelle comme un fait, mais sans lui inventer de lien causal avec le volume de chat.
- Le signal « clics détaillants » (select_retailer / view_item), quand fourni, est la conversion réelle du site vitrine : tu peux le citer comme fait.
- Si les métriques suggèrent des sujets récurrents ou toute observation qui n'est pas un chiffre compté directement, qualifie-la explicitement d'estimation.
- Réponds en français, en 3 à 5 puces courtes et factuelles (une ligne chacune, préfixée par "- "), sans préambule ni conclusion.`;

async function callAiSummary(kpis: CeoKpis, catalogue: CatalogPresence, ga4Events: Ga4Events): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey });

    const userPayload = {
      periode: kpis.period,
      volumeInteractions: kpis.interactions.total,
      coutIaEstimeCad: Number(kpis.cost.totalCad.toFixed(2)),
      modeleCourant: kpis.model,
      nombreSessions: kpis.sessions.total,
      sessionsEscaladees: kpis.sessions.escalated,
      tauxEscalade:
        kpis.sessions.escalationRate === null
          ? "n/a (aucune session sur la période)"
          : `${(kpis.sessions.escalationRate * 100).toFixed(1)}%`,
      catalogue:
        catalogue.status === "ok"
          ? {
              skusEnMarche: catalogue.skus,
              collectionsDistinctes: catalogue.collections,
              provincesCouvertes: catalogue.provinces,
            }
          : "non_instrumente",
      clicsDetaillants:
        ga4Events.status === "ok"
          ? { selectRetailer: ga4Events.selectRetailer, viewItem: ga4Events.viewItem }
          : "non_instrumente",
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

// ─────────────────────────────────────────────────────────────
// Lecture GA4 (trafic/clics SiteBleuh) — via la GA4 Data API (runReport).
// Auth par ADC (le SA du service). Dégradation propre et systématique :
// pas de GA4_PROPERTY_ID configurée OU appel qui échoue (SA sans accès à
// la propriété GA4, etc.) → { status: 'non_instrumente' }, jamais de crash.
// ─────────────────────────────────────────────────────────────

/**
 * Trafic GA4 (sessions, utilisateurs actifs, pages vues) sur les N derniers
 * jours, pour la propriété GA4 de SiteBleuh (env GA4_PROPERTY_ID, numérique).
 */
export async function getGa4Traffic(days: number): Promise<Ga4Traffic> {
  const propertyId = process.env.GA4_PROPERTY_ID;
  if (!propertyId || !propertyId.trim()) {
    return { status: "non_instrumente" };
  }

  try {
    const { BetaAnalyticsDataClient } = await import("@google-analytics/data");
    const client = new BetaAnalyticsDataClient();

    const [response] = await client.runReport({
      property: `properties/${propertyId.trim()}`,
      dateRanges: [{ startDate: `${days}daysAgo`, endDate: "today" }],
      metrics: [{ name: "sessions" }, { name: "activeUsers" }, { name: "screenPageViews" }],
    });

    const values = response.rows?.[0]?.metricValues;
    const sessions = Number(values?.[0]?.value) || 0;
    const activeUsers = Number(values?.[1]?.value) || 0;
    const screenPageViews = Number(values?.[2]?.value) || 0;

    return { status: "ok", sessions, activeUsers, screenPageViews };
  } catch (e) {
    console.warn("[ceo-analysis] lecture GA4 échouée (SA sans accès à la propriété ?) :", e);
    return { status: "non_instrumente" };
  }
}

/**
 * Comptage d'événements GA4 par nom (runReport, dimension `eventName`,
 * métrique `eventCount`) sur les N derniers jours. Le site étant une
 * VITRINE non transactionnelle (Bleuh vend via SQDC/OCS), le signal de
 * conversion réel est le clic vers un détaillant (`select_retailer`) — pas
 * une vente. `view_item` (vues de fiche produit) est remonté en complément
 * quand disponible. Même dégradation propre que getGa4Traffic : pas de
 * GA4_PROPERTY_ID ou appel qui échoue → { status: 'non_instrumente' }.
 */
export async function getGa4Events(days: number): Promise<Ga4Events> {
  const propertyId = process.env.GA4_PROPERTY_ID;
  if (!propertyId || !propertyId.trim()) {
    return { status: "non_instrumente" };
  }

  try {
    const { BetaAnalyticsDataClient } = await import("@google-analytics/data");
    const client = new BetaAnalyticsDataClient();

    const [response] = await client.runReport({
      property: `properties/${propertyId.trim()}`,
      dateRanges: [{ startDate: `${days}daysAgo`, endDate: "today" }],
      dimensions: [{ name: "eventName" }],
      metrics: [{ name: "eventCount" }],
    });

    let selectRetailer = 0;
    let viewItem = 0;
    for (const row of response.rows ?? []) {
      const name = row.dimensionValues?.[0]?.value;
      const count = Number(row.metricValues?.[0]?.value) || 0;
      if (name === "select_retailer") selectRetailer = count;
      if (name === "view_item") viewItem = count;
    }

    return { status: "ok", selectRetailer, viewItem };
  } catch (e) {
    console.warn("[ceo-analysis] lecture GA4 (événements) échouée (SA sans accès à la propriété ?) :", e);
    return { status: "non_instrumente" };
  }
}

// ─────────────────────────────────────────────────────────────
// Présence catalogue — signal commercial RÉEL, lu directement dans la
// collection Firestore `products` (même base que products-service, réutilise
// adminDb()). Compte les produits publiés (SKUs en marché), leurs collections
// distinctes et les provinces couvertes. Jamais de throw : collection vide,
// illisible ou Firestore injoignable → { status: 'non_instrumente' }.
// ─────────────────────────────────────────────────────────────

export async function getCatalogPresence(): Promise<CatalogPresence> {
  try {
    const snap = await adminDb().collection(PRODUCTS_COLLECTION).where("status", "==", "published").get();
    if (snap.empty) return { status: "non_instrumente" };

    const collections = new Set<string>();
    const provinces = new Set<string>();
    snap.docs.forEach((doc) => {
      const data = doc.data();
      if (typeof data.collection === "string" && data.collection.trim()) {
        collections.add(data.collection.trim());
      }
      if (Array.isArray(data.provinces)) {
        data.provinces.forEach((p: unknown) => {
          if (typeof p === "string" && p.trim()) provinces.add(p);
        });
      }
    });

    return {
      status: "ok",
      skus: snap.size,
      collections: collections.size,
      provinces: Array.from(provinces).sort(),
    };
  } catch (e) {
    console.warn("[ceo-analysis] lecture products échouée :", e);
    return { status: "non_instrumente" };
  }
}

export async function buildCeoAnalysis(period: CeoPeriod): Promise<CeoAnalysisResult> {
  const kpis = await buildCeoKpis(period);
  const [ga4, ga4Events, catalogue] = await Promise.all([
    getGa4Traffic(kpis.days),
    getGa4Events(kpis.days),
    getCatalogPresence(),
  ]);
  const aiSummary = await callAiSummary(kpis, catalogue, ga4Events);

  return {
    generatedAt: new Date().toISOString(),
    period,
    kpis,
    sources: { ga4, ga4Events, catalogue },
    aiSummary,
  };
}

// ─────────────────────────────────────────────────────────────
// Analyse approfondie (déclenchée manuellement, coûte des tokens) —
// mêmes KPIs réels + prompt plus riche à claude-sonnet-4-6, 5-8 insights
// stratégiques + recommandations concrètes. Reste factuel/conforme (pas
// d'allégation santé) : mêmes garde-fous que AI_SYSTEM_PROMPT, renforcés.
// ─────────────────────────────────────────────────────────────

const DEEP_ANALYSIS_SYSTEM_PROMPT = `Tu es un analyste senior qui produit une analyse stratégique approfondie des indicateurs internes de Bleuh pour un CEO.
Contexte métier impératif : bleuh.co est un site VITRINE/catalogue, PAS un site de vente. Bleuh vend en gros aux détaillants provinciaux (SQDC au Québec, OCS en Ontario) ; le site sert à faire découvrir les produits et à rediriger l'acheteur vers ces détaillants. Les KPIs pertinents sont donc : la fréquentation et l'engagement du site, les clics vers les détaillants (événement GA4 select_retailer — LA conversion réelle du site), la présence catalogue, et la performance du bot support.
Règles strictes :
- Ne commente QUE les métriques fournies dans le message utilisateur. N'invente aucun chiffre, aucune donnée externe.
- INTERDICTION ABSOLUE d'employer ou de suggérer les mots « ventes », « revenus », « chiffre d'affaires », « sell-through » ou toute notion équivalente : ce module ne les mesure pas et le site ne vend pas directement.
- Le signal « catalogue » (SKUs en marché, collections, provinces), s'il est fourni, est une donnée réelle distincte lue dans le catalogue produits : tu peux la citer comme fait mais sans lui inventer de lien causal avec le volume de chat.
- Le signal « clics détaillants » (select_retailer / view_item), s'il est fourni, est la conversion réelle du site vitrine : tu peux le citer comme fait et t'en servir pour tes recommandations, sans lien de causalité inventé avec le volume de chat.
- N'énonce JAMAIS d'allégation de santé (produits liés au cannabis/chanvre) — reste strictement sur l'usage du service de support et les indicateurs opérationnels du site.
- Produis entre 5 et 8 insights stratégiques, chacun avec une recommandation concrète et actionnable.
- Qualifie explicitement d'estimation toute observation qui n'est pas un chiffre compté directement (ex. coût IA, tendances).
- Réponds en français, format : une puce "- " par insight, chaque puce contenant l'observation suivie de « → Recommandation : ... ». Sans préambule ni conclusion.`;

export interface DeepAnalysisResult {
  generatedAt: string;
  period: CeoPeriod;
  model: string;
  kpis: CeoKpis;
  insights: string | null;
}

/**
 * Analyse approfondie sur demande (bouton « Lancer une vraie analyse »).
 * Recalcule les KPIs réels (fenêtre à jour) puis interroge claude-sonnet-4-6
 * avec un prompt plus riche. Sans clé Anthropic → insights null (pas de crash).
 */
export async function runDeepCeoAnalysis(period: CeoPeriod): Promise<DeepAnalysisResult> {
  const kpis = await buildCeoKpis(period);
  const [catalogue, ga4Events] = await Promise.all([getCatalogPresence(), getGa4Events(kpis.days)]);
  const apiKey = process.env.ANTHROPIC_API_KEY;

  let insights: string | null = null;
  if (apiKey) {
    try {
      const { default: Anthropic } = await import("@anthropic-ai/sdk");
      const client = new Anthropic({ apiKey });

      const userPayload = {
        periode: kpis.period,
        jours: kpis.days,
        volumeInteractions: kpis.interactions.total,
        interactionsParJour: kpis.interactions.byDay.map((d) => ({ date: d.date, requetes: d.requests })),
        coutIaEstimeCad: Number(kpis.cost.totalCad.toFixed(2)),
        modeleCourant: kpis.model,
        nombreSessions: kpis.sessions.total,
        sessionsEscaladees: kpis.sessions.escalated,
        tauxEscalade:
          kpis.sessions.escalationRate === null
            ? "n/a (aucune session sur la période)"
            : `${(kpis.sessions.escalationRate * 100).toFixed(1)}%`,
        catalogue:
          catalogue.status === "ok"
            ? {
                skusEnMarche: catalogue.skus,
                collectionsDistinctes: catalogue.collections,
                provincesCouvertes: catalogue.provinces,
              }
            : "non_instrumente",
        clicsDetaillants:
          ga4Events.status === "ok"
            ? { selectRetailer: ga4Events.selectRetailer, viewItem: ga4Events.viewItem }
            : "non_instrumente",
      };

      const response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1536,
        system: DEEP_ANALYSIS_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `Voici les KPIs du bot Bleuh sur la période ${kpis.period} (analyse approfondie demandée manuellement) :\n${JSON.stringify(userPayload, null, 2)}`,
          },
        ],
      });

      insights =
        response.content
          .filter((block): block is { type: "text"; text: string } => block.type === "text")
          .map((block) => block.text)
          .join("\n")
          .trim() || null;
    } catch (e) {
      console.warn("[ceo-analysis] analyse approfondie Anthropic échouée :", e);
      insights = null;
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    period,
    model: "claude-sonnet-4-6",
    kpis,
    insights,
  };
}
