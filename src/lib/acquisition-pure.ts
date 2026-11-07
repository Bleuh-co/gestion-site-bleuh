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

// ─────────────────────────────────────────────────────────────
// Frictions — où les visiteurs butent (écrites par site-bleuh, /api/friction)
// ─────────────────────────────────────────────────────────────
// Duplication délibérée avec site-bleuh/src/lib/friction-pure.ts (mêmes 5
// types, plus `autres`) : dépôts séparés, aucun paquet partagé — même parti
// pris que traffic-pure.ts. AUCUNE IDENTITÉ dans ce qui suit : ni visiteur, ni
// IP, seulement des compteurs par signature (type + page + libellé + statut).

/**
 * Les 5 types écrits par site-bleuh, plus `autres` : le document fourre-tout
 * du plafond anti-abus quotidien (voir /api/friction, FRICTION_OVERFLOW_ID).
 */
export const FRICTION_TYPES = [
  "erreur_js",
  "echec_api",
  "lenteur_api",
  "clic_rageur",
  "clic_mort",
  "autres",
] as const;
export type FrictionRowType = (typeof FRICTION_TYPES)[number];

const FRICTION_TYPE_SET: ReadonlySet<string> = new Set(FRICTION_TYPES);

function frictionRowType(v: unknown): FrictionRowType {
  return typeof v === "string" && FRICTION_TYPE_SET.has(v) ? (v as FrictionRowType) : "autres";
}

export interface FrictionInput {
  /** Identifiant du document (la signature) — sert à recoller les jours. */
  id: string;
  type?: unknown;
  page?: unknown;
  libelle?: unknown;
  statut?: unknown;
  n?: unknown;
  /** Jour UTC (`YYYY-MM-DD`) du document d'où provient cette ligne. */
  date?: unknown;
}

export interface FrictionRow {
  id: string;
  type: FrictionRowType;
  page: string;
  libelle: string;
  statut: number | null;
  count: number;
  /** Dernier jour (`YYYY-MM-DD`) où cette friction a été vue, sur la période demandée. */
  lastDay: string;
}

/**
 * Agrège les lignes de friction (un document par jour ET par signature) par
 * SIGNATURE à travers toute la période : même identifiant de document, même
 * friction — un seul jour suffit à la décrire, les autres n'ajoutent que leur
 * compte et, s'il est plus récent, leur jour.
 */
export function aggregateFrictions(rows: FrictionInput[]): FrictionRow[] {
  const byId = new Map<string, FrictionRow>();
  for (const r of rows) {
    if (!r.id) continue; // sécurité : sans identifiant, rien à recoller entre les jours
    const count = num(r.n);
    const day = typeof r.date === "string" ? r.date : "";
    const existing = byId.get(r.id);
    if (existing) {
      existing.count += count;
      if (day > existing.lastDay) existing.lastDay = day;
    } else {
      byId.set(r.id, {
        id: r.id,
        type: frictionRowType(r.type),
        page: typeof r.page === "string" && r.page !== "" ? r.page : "—",
        libelle: typeof r.libelle === "string" ? r.libelle : "",
        statut: typeof r.statut === "number" && Number.isFinite(r.statut) ? r.statut : null,
        count,
        lastDay: day,
      });
    }
  }
  return [...byId.values()].sort((a, b) => b.count - a.count);
}

/** « GET /api/produits · 500 » — le libellé, et le statut quand il y en a un. */
export function formatFrictionOutcome(libelle: string, statut: number | null): string {
  const base = libelle || "—";
  return statut != null ? `${base} · ${statut}` : base;
}

/** Nombre de `select_retailer` porté par une ligne de source. */
function retailerClicksOf(events: unknown): number {
  if (!events || typeof events !== "object") return 0;
  return num((events as Record<string, unknown>).select_retailer);
}

// ─────────────────────────────────────────────────────────────
// Lot L5 (plan publicite-bdion, 06-07/11/2026) — clics vers un détaillant,
// par chemin, zone, campagne, création et produit.
// ─────────────────────────────────────────────────────────────
// Écrits par site-bleuh (`src/app/api/track/route.ts`, sous-collection
// `retailer_clicks` de chaque jour) : UNE ligne par combinaison chemin ×
// zone × campagne × création × produit, incrémentée à chaque clic d'essai.
// Duplication délibérée du vocabulaire des cinq chemins avec site-bleuh
// (`lib/traffic-pure.ts`) — mêmes raisons que le reste de ce fichier : deux
// dépôts séparés, aucun paquet partagé.

const RETAILER_CLICK_PATHS = [
  "fiche_produit",
  "localisateur",
  "commander_en_ligne",
  "pied_de_page",
  "wildberry",
] as const;
const RETAILER_CLICK_PATH_SET: ReadonlySet<string> = new Set(RETAILER_CLICK_PATHS);

/** Un chemin hors convention (futur, ou mal écrit) retombe sur « autre ». */
function retailerClickPathOf(v: unknown): string {
  return typeof v === "string" && RETAILER_CLICK_PATH_SET.has(v) ? v : "autre";
}

function retailerClickZoneOf(v: unknown): string {
  return v === "qc" || v === "on" ? v : "—";
}

export interface RetailerClickInput {
  /** Identifiant du document (chemin×zone×campagne×création×produit) — sert à recoller les jours. */
  id: string;
  chemin?: unknown;
  zone?: unknown;
  utmCampaign?: unknown;
  utmContent?: unknown;
  productId?: unknown;
  productName?: unknown;
  count?: unknown;
  /** Jour UTC (`YYYY-MM-DD`) du document d'où provient cette ligne. */
  date?: unknown;
}

export interface RetailerClickRow {
  id: string;
  chemin: string;
  zone: string;
  /** Code de campagne tel qu'il arrive dans l'URL (utm_campaign), ex. blh-r1-wildberry-nouveau-ontario. */
  campaign: string;
  /** La « création » du lien suivi (utm_content). */
  creation: string;
  product: string;
  clicks: number;
  /** Dernier jour (`YYYY-MM-DD`) où ce clic a été vu, sur la période demandée. */
  lastDay: string;
}

/**
 * Agrège les clics vers un détaillant par SIGNATURE (même identifiant de
 * document = même combinaison chemin/zone/campagne/création/produit) à
 * travers toute la période — même patron que `aggregateFrictions` ci-dessus,
 * pour la même raison : un document par jour ET par signature, recollés ici.
 */
export function aggregateRetailerClicks(rows: RetailerClickInput[]): RetailerClickRow[] {
  const byId = new Map<string, RetailerClickRow>();
  for (const r of rows) {
    if (!r.id) continue; // sécurité : sans identifiant, rien à recoller entre les jours
    const clicks = num(r.count);
    const day = typeof r.date === "string" ? r.date : "";
    const existing = byId.get(r.id);
    if (existing) {
      existing.clicks += clicks;
      if (day > existing.lastDay) existing.lastDay = day;
    } else {
      byId.set(r.id, {
        id: r.id,
        chemin: retailerClickPathOf(r.chemin),
        zone: retailerClickZoneOf(r.zone),
        campaign: cleanUtmValue(r.utmCampaign) ?? "—",
        creation: cleanUtmValue(r.utmContent) ?? "—",
        product: cleanUtmValue(r.productName) ?? "—",
        clicks,
        lastDay: day,
      });
    }
  }
  return [...byId.values()].sort((a, b) => b.clicks - a.clicks);
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
  frictions: FrictionRow[];
  /** Lot L5 (plan publicite-bdion) : les cinq chemins vers un détaillant, détaillés. */
  retailerClicks: RetailerClickRow[];
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

/** Au-delà, une plage libre n'est plus une sélection mais une erreur (ou un abus) — même ordre de grandeur que marketing-mdh (`PLAGE_MAX_JOURS`). */
export const PLAGE_MAX_JOURS = 366;

/**
 * Jours UTC (`YYYY-MM-DD`) entre deux bornes incluses, du plus ancien au plus
 * récent (lot L9, plan publicite-bdion) : pour l'onglet Chiffres de Studio
 * (« Hier », ou une période libre), en plus des raccourcis `period` existants
 * (7/30/90). `null` si les bornes sont invalides, dans le désordre, dans le
 * futur, ou si la plage dépasse `PLAGE_MAX_JOURS` — jamais une plage
 * silencieusement tronquée.
 */
export function daysBetweenUtc(du: string, au: string, now: Date = new Date()): string[] | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(du) || !/^\d{4}-\d{2}-\d{2}$/.test(au)) return null;
  const debut = Date.parse(`${du}T00:00:00.000Z`);
  const fin = Date.parse(`${au}T00:00:00.000Z`);
  const aujourdhui = now.toISOString().slice(0, 10);
  if (!Number.isFinite(debut) || !Number.isFinite(fin) || du > au || au > aujourdhui) return null;
  const jours = Math.round((fin - debut) / 86400000) + 1;
  if (jours > PLAGE_MAX_JOURS) return null;
  const out: string[] = [];
  for (let i = 0; i < jours; i++) out.push(new Date(debut + i * 86400000).toISOString().slice(0, 10));
  return out;
}

export function buildAcquisitionReport(input: {
  trafficSources: TrafficSourceInput[];
  pages: PageInput[];
  frictions: FrictionInput[];
  /**
   * Lot L5 (plan publicite-bdion) : optionnel pour ne pas casser un appelant
   * antérieur à ce lot (ou un test qui ignore cette dimension) — absent, il
   * rend simplement une liste vide, jamais une erreur.
   */
  retailerClicks?: RetailerClickInput[];
  days: string[];
}): AcquisitionReport {
  const { trafficSources, pages, frictions, days, retailerClicks = [] } = input;

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
    frictions: aggregateFrictions(frictions),
    retailerClicks: aggregateRetailerClicks(retailerClicks),
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
