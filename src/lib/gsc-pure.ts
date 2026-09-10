// ─────────────────────────────────────────────────────────────
// Google Search Console — helpers PURS (aucune I/O). La partie
// réseau/Firestore vit dans gsc-service.ts. Jumeau du module de
// marketing-mdh (test/gsc.test.ts là-bas couvre ces fonctions).
//
// Contrat de stockage : un document Firestore PAR JOUR dans
// `gsc_daily` (adminDb), id `day_YYYY-MM-DD`. Chaque doc est
// autoportant : totaux du jour + top requêtes/pages/appareils/pays.
// GSC ne conserve que 16 mois — cette collection est notre archive
// illimitée, on n'y détruit jamais rien.
// ─────────────────────────────────────────────────────────────

/** Ligne brute renvoyée par l'API searchanalytics.query. */
export interface GscApiRow {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
}

/** Une entrée agrégée (requête, page, appareil ou pays). */
export interface GscEntry {
  key: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GscTotals {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

/** Instantané de l'état des sitemaps déclarés dans GSC. */
export interface GscSitemapInfo {
  path: string;
  lastSubmitted: string | null;
  lastDownloaded: string | null;
  isPending: boolean;
  errors: number;
  warnings: number;
  submitted: number;
  indexed: number;
}

/** Document `day_YYYY-MM-DD` de la collection GSC quotidienne. */
export interface GscDayDoc {
  date: string;
  siteUrl: string;
  totals: GscTotals;
  queries: GscEntry[];
  pages: GscEntry[];
  devices: GscEntry[];
  countries: GscEntry[];
  sitemaps: GscSitemapInfo[];
  fetchedAt: string;
}

export const GSC_DAY_DOC_PREFIX = "day_";

/** Nombre max de jours par synchronisation (garde le backfill 16 mois possible : ~490 j). */
export const GSC_MAX_RANGE_DAYS = 550;

export const GSC_TOP_LIMIT = 100;
export const GSC_SMALL_LIMIT = 25;

export function gscDayDocId(date: string): string {
  return `${GSC_DAY_DOC_PREFIX}${date}`;
}

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function addDaysUtc(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Jours à synchroniser par défaut : J-4 → J-2 (UTC). Search Console publie
 * ses données avec ~2 jours de retard ; on repasse sur 3 jours pour absorber
 * les consolidations tardives (les docs sont réécrits, jamais dupliqués).
 */
export function defaultSyncDates(today: Date = new Date()): string[] {
  const ref = today.toISOString().slice(0, 10);
  return [addDaysUtc(ref, -4), addDaysUtc(ref, -3), addDaysUtc(ref, -2)];
}

/**
 * Liste inclusive de dates ISO entre start et end. Jette si les bornes sont
 * invalides ou si l'intervalle dépasse GSC_MAX_RANGE_DAYS.
 */
export function listDates(start: string, end: string): string[] {
  if (!isIsoDate(start) || !isIsoDate(end)) {
    throw new Error(`Bornes invalides : « ${start} » → « ${end} » (format YYYY-MM-DD).`);
  }
  if (start > end) throw new Error(`Intervalle inversé : ${start} > ${end}.`);
  const out: string[] = [];
  let cur = start;
  while (cur <= end) {
    out.push(cur);
    if (out.length > GSC_MAX_RANGE_DAYS) {
      throw new Error(`Intervalle trop long (max ${GSC_MAX_RANGE_DAYS} jours).`);
    }
    cur = addDaysUtc(cur, 1);
  }
  return out;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

/** Normalise des lignes API en entrées triées par clics puis impressions. */
export function toEntries(rows: GscApiRow[] | undefined, limit: number): GscEntry[] {
  return (rows ?? [])
    .filter((r) => Array.isArray(r.keys) && r.keys.length > 0)
    .map((r) => ({
      key: String(r.keys![0]),
      clicks: r.clicks ?? 0,
      impressions: r.impressions ?? 0,
      ctr: round4(r.ctr ?? 0),
      position: round4(r.position ?? 0),
    }))
    .sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions)
    .slice(0, limit);
}

/** Totaux du jour depuis la réponse sans dimension (0 ou 1 ligne). */
export function toTotals(rows: GscApiRow[] | undefined): GscTotals {
  const r = rows?.[0];
  return {
    clicks: r?.clicks ?? 0,
    impressions: r?.impressions ?? 0,
    ctr: round4(r?.ctr ?? 0),
    position: round4(r?.position ?? 0),
  };
}

/**
 * Somme de totaux quotidiens sur une période. Les compteurs s'additionnent ;
 * `ctr` et `position` sont REPONDÉRÉS par les impressions — les moyenner
 * naïvement donnerait un poids identique à un jour à 3 impressions et à un
 * jour à 3 000, donc un chiffre faux.
 */
export function sumTotals(list: GscTotals[]): GscTotals {
  let clicks = 0;
  let impressions = 0;
  let posWeighted = 0;
  for (const t of list) {
    clicks += t.clicks;
    impressions += t.impressions;
    posWeighted += t.position * t.impressions;
  }
  return {
    clicks,
    impressions,
    ctr: impressions > 0 ? round4(clicks / impressions) : 0,
    position: impressions > 0 ? round4(posWeighted / impressions) : 0,
  };
}

/**
 * Fusionne des listes d'entrées quotidiennes (requêtes, pages…) en un top de
 * période : clics et impressions additionnés par clé, `ctr` recalculé,
 * `position` repondérée par les impressions. Limite : chaque jour ne stocke
 * que son top 100, la longue traîne au-delà est donc absente — négligeable
 * pour un « top » de période, qui vit tout en haut du classement.
 */
export function aggregateEntries(lists: GscEntry[][], limit: number): GscEntry[] {
  const map = new Map<string, { clicks: number; impressions: number; posWeighted: number }>();
  for (const list of lists) {
    for (const e of list) {
      const acc = map.get(e.key) ?? { clicks: 0, impressions: 0, posWeighted: 0 };
      acc.clicks += e.clicks;
      acc.impressions += e.impressions;
      acc.posWeighted += e.position * e.impressions;
      map.set(e.key, acc);
    }
  }
  return [...map.entries()]
    .map(([key, a]) => ({
      key,
      clicks: a.clicks,
      impressions: a.impressions,
      ctr: a.impressions > 0 ? round4(a.clicks / a.impressions) : 0,
      position: a.impressions > 0 ? round4(a.posWeighted / a.impressions) : 0,
    }))
    .sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions)
    .slice(0, limit);
}

export interface BuildDayDocInput {
  date: string;
  siteUrl: string;
  totalsRows: GscApiRow[] | undefined;
  queryRows: GscApiRow[] | undefined;
  pageRows: GscApiRow[] | undefined;
  deviceRows: GscApiRow[] | undefined;
  countryRows: GscApiRow[] | undefined;
  sitemaps: GscSitemapInfo[];
  fetchedAt: string;
}

export function buildDayDoc(input: BuildDayDocInput): GscDayDoc {
  return {
    date: input.date,
    siteUrl: input.siteUrl,
    totals: toTotals(input.totalsRows),
    queries: toEntries(input.queryRows, GSC_TOP_LIMIT),
    pages: toEntries(input.pageRows, GSC_TOP_LIMIT),
    devices: toEntries(input.deviceRows, GSC_SMALL_LIMIT),
    countries: toEntries(input.countryRows, GSC_SMALL_LIMIT),
    sitemaps: input.sitemaps,
    fetchedAt: input.fetchedAt,
  };
}
