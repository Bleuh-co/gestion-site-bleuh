/**
 * Acquisition — d'où viennent les visites de bleuh.co. Logique PURE.
 * (Ticket Zb7pyfcfEQTRo1FcwwWB.)
 *
 * ⚠ CE QUI DIFFÈRE DE MAISON D'HERBES, et qu'il ne faut pas gommer.
 * bleuh.co est un site VITRINE : aucune vente n'y est conclue, aucun panier,
 * aucun chiffre d'affaires. Le seul aboutissement mesurable est le clic
 * sortant vers un détaillant (SQDC/OCS) — l'événement `select_retailer`.
 *
 * Cet écran l'affiche donc comme « clics vers un détaillant », JAMAIS comme
 * une vente, et le taux qui l'accompagne est un taux de clic sortant, pas un
 * taux de conversion. La demande initiale (« comme pour bleuh… voir les ventes
 * qui en découlent ») supposait que Bleuh savait déjà faire cela : il ne le
 * savait pas, et il ne peut pas le savoir — ce qui se passe ensuite chez le
 * détaillant nous est invisible. Écrire « ventes » ici serait inventer un
 * chiffre.
 *
 * Le vocabulaire de provenance est celui de site-mdh/site-bleuh, donc celui de
 * sourcebuster, pour que les tableaux de bord des deux marques se lisent côte
 * à côte sans traduction mentale.
 */

export type SourceType = "utm" | "organic" | "referral" | "typein";

export type Channel =
  | "direct"
  | "organique"
  | "courriel"
  | "social"
  | "payant"
  | "reference"
  | "autre";

export interface TrafficSource {
  sourceType: SourceType;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
}

const SOCIAL_HINTS = [
  "facebook", "instagram", "tiktok", "linkedin", "pinterest",
  "youtube", "x.com", "twitter", "reddit", "threads", "fb",
];
const PAID_HINTS = ["cpc", "ppc", "paid", "ads", "adwords", "display", "retargeting"];
const EMAIL_HINTS = ["email", "courriel", "newsletter", "infolettre", "mailerlite"];

/**
 * Classe une source dans un canal lisible. « Courriel » passe avant « payant »
 * : une campagne d'infolettre achetée reste une performance de l'infolettre,
 * qui est le canal qu'on pilote.
 */
export function channelOf(source: TrafficSource): Channel {
  const medium = (source.utmMedium || "").toLowerCase();
  const src = (source.utmSource || "").toLowerCase();
  const hay = `${medium} ${src}`;

  if (EMAIL_HINTS.some((h) => hay.includes(h))) return "courriel";
  if (PAID_HINTS.some((h) => medium.includes(h))) return "payant";
  if (SOCIAL_HINTS.some((h) => src.split(/[\s,._-]+/).includes(h) || src.includes(h))) {
    return "social";
  }

  switch (source.sourceType) {
    case "organic": return "organique";
    case "referral": return "reference";
    case "typein": return "direct";
    default: return "autre";
  }
}

const MAX_LABEL = 80;

/**
 * Rend lisible une valeur d'attribution : décode l'encodage de formulaire
 * (« + » vaut un espace, puis %XX) et éclate les valeurs empilées par des
 * virgules.
 *
 * Le trafic de Bleuh est écrit par notre propre classification, donc propre.
 * Ce nettoyage existe quand même pour deux raisons : les `utm_*` viennent de
 * l'URL, donc de l'extérieur, et n'importe qui peut coller un lien encodé ; et
 * le module doit rester interchangeable avec celui de marketing-mdh, où
 * l'historique WooCommerce est réellement sale.
 */
export function cleanUtmValue(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const parts = raw
    .split(",")
    .map((p) => {
      const withSpaces = p.replace(/\+/g, " ").trim();
      try {
        return decodeURIComponent(withSpaces).trim();
      } catch {
        return withSpaces;
      }
    })
    .filter((p) => p !== "");

  const uniques: string[] = [];
  for (const p of parts) {
    if (!uniques.some((u) => u.toLowerCase() === p.toLowerCase())) uniques.push(p);
  }
  if (uniques.length === 0) return null;
  return uniques.join(" · ").slice(0, MAX_LABEL);
}

// ─────────────────────────────────────────────────────────────
// Agrégation
// ─────────────────────────────────────────────────────────────

export interface TrafficSourceInput {
  sourceType?: unknown;
  utmSource?: unknown;
  utmMedium?: unknown;
  utmCampaign?: unknown;
  sessions?: unknown;
  pageViews?: unknown;
  engagementMs?: unknown;
  events?: unknown;
  /** Jour UTC (`YYYY-MM-DD`) d'où provient la ligne. */
  date?: unknown;
}

export interface PageInput {
  path?: unknown;
  views?: unknown;
  engagedViews?: unknown;
  engagementMs?: unknown;
}

const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Nombre de `select_retailer` porté par une ligne de source. */
function retailerClicksOf(events: unknown): number {
  if (!events || typeof events !== "object") return 0;
  return num((events as Record<string, unknown>).select_retailer);
}

export interface ChannelRow {
  channel: Channel;
  sessions: number;
  pageViews: number;
  engagementMs: number;
  /** Clics sortants vers un détaillant. Ce n'est PAS une vente. */
  retailerClicks: number;
  /** Clics sortants ÷ sessions. `null` sans session mesurée. */
  clickRate: number | null;
}

export interface CampaignRow {
  key: string;
  channel: Channel;
  source: string;
  medium: string;
  campaign: string;
  sessions: number;
  retailerClicks: number;
}

export interface PageRow {
  path: string;
  views: number;
  engagedViews: number;
  engagementMs: number;
  averageEngagementMs: number | null;
}

export interface DayPoint {
  date: string;
  sessions: number;
  retailerClicks: number;
}

export interface AcquisitionReport {
  channels: ChannelRow[];
  campaigns: CampaignRow[];
  pages: PageRow[];
  series: DayPoint[];
  totals: {
    sessions: number;
    pageViews: number;
    retailerClicks: number;
    clickRate: number | null;
    averageEngagementMs: number | null;
  };
  /** Vrai tant que la mesure n'a rien écrit sur la fenêtre demandée. */
  trafficPending: boolean;
}

const labelOf = (v: string | null): string => v ?? "—";

/** Liste des N derniers jours UTC, du plus ancien au plus récent. */
export function lastNDaysUtc(days: number, now: Date = new Date()): string[] {
  const out: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    out.push(new Date(now.getTime() - i * 86400000).toISOString().slice(0, 10));
  }
  return out;
}

export function buildAcquisitionReport(input: {
  trafficSources: TrafficSourceInput[];
  pages: PageInput[];
  days: string[];
}): AcquisitionReport {
  const { trafficSources, pages, days } = input;

  const channels = new Map<Channel, ChannelRow>();
  const campaigns = new Map<string, CampaignRow>();
  const byDay = new Map<string, DayPoint>();
  for (const d of days) byDay.set(d, { date: d, sessions: 0, retailerClicks: 0 });

  let sawTraffic = false;

  for (const t of trafficSources) {
    sawTraffic = true;
    const source: TrafficSource = {
      sourceType:
        t.sourceType === "utm" || t.sourceType === "organic" ||
        t.sourceType === "referral" || t.sourceType === "typein"
          ? t.sourceType
          : "typein",
      utmSource: cleanUtmValue(t.utmSource),
      utmMedium: cleanUtmValue(t.utmMedium),
      utmCampaign: cleanUtmValue(t.utmCampaign),
    };
    const ch = channelOf(source);
    const sessions = num(t.sessions);
    const clicks = retailerClicksOf(t.events);

    let row = channels.get(ch);
    if (!row) {
      row = {
        channel: ch,
        sessions: 0,
        pageViews: 0,
        engagementMs: 0,
        retailerClicks: 0,
        clickRate: null,
      };
      channels.set(ch, row);
    }
    row.sessions += sessions;
    row.pageViews += num(t.pageViews);
    row.engagementMs += num(t.engagementMs);
    row.retailerClicks += clicks;

    const key = `${ch}|${labelOf(source.utmSource)}|${labelOf(source.utmMedium)}|${labelOf(source.utmCampaign)}`;
    const existing = campaigns.get(key);
    if (existing) {
      existing.sessions += sessions;
      existing.retailerClicks += clicks;
    } else {
      campaigns.set(key, {
        key,
        channel: ch,
        source: labelOf(source.utmSource),
        medium: labelOf(source.utmMedium),
        campaign: labelOf(source.utmCampaign),
        sessions,
        retailerClicks: clicks,
      });
    }

    const point = typeof t.date === "string" ? byDay.get(t.date) : undefined;
    if (point) {
      point.sessions += sessions;
      point.retailerClicks += clicks;
    }
  }

  for (const row of channels.values()) {
    // `null`, jamais 0 % : sans session mesurée on ne SAIT pas, et « 0 % »
    // laisserait croire que le canal ne produit aucun clic sortant.
    row.clickRate = row.sessions > 0 ? row.retailerClicks / row.sessions : null;
  }

  const pageRows: PageRow[] = pages
    .map((p) => {
      const engagedViews = num(p.engagedViews);
      const engagementMs = num(p.engagementMs);
      return {
        path: typeof p.path === "string" && p.path !== "" ? p.path : "—",
        views: num(p.views),
        engagedViews,
        engagementMs,
        // Dénominateur : les vues qui ont RÉELLEMENT remonté leur temps.
        averageEngagementMs: engagedViews > 0 ? engagementMs / engagedViews : null,
      };
    })
    .sort((a, b) => b.views - a.views || b.engagementMs - a.engagementMs);

  const list = [...channels.values()];
  const totalSessions = list.reduce((s, r) => s + r.sessions, 0);
  const totalClicks = list.reduce((s, r) => s + r.retailerClicks, 0);
  const totalEngagedViews = pageRows.reduce((s, p) => s + p.engagedViews, 0);
  const totalEngagementMs = pageRows.reduce((s, p) => s + p.engagementMs, 0);

  return {
    channels: list.sort((a, b) => b.sessions - a.sessions),
    campaigns: [...campaigns.values()].sort(
      (a, b) => b.sessions - a.sessions || b.retailerClicks - a.retailerClicks
    ),
    pages: pageRows,
    series: days.map((d) => byDay.get(d) as DayPoint),
    totals: {
      sessions: totalSessions,
      pageViews: list.reduce((s, r) => s + r.pageViews, 0),
      retailerClicks: totalClicks,
      clickRate: totalSessions > 0 ? totalClicks / totalSessions : null,
      averageEngagementMs: totalEngagedViews > 0 ? totalEngagementMs / totalEngagedViews : null,
    },
    trafficPending: !sawTraffic,
  };
}

/** Formatage d'une durée en millisecondes → « 1 min 24 s ». */
export function formatDuration(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms) || ms <= 0) return "—";
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m} min ${String(s).padStart(2, "0")} s` : `${s} s`;
}
