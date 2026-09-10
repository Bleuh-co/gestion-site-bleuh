import "server-only";
import { GoogleAuth } from "google-auth-library";
import { adminDb } from "@/lib/firebase-admin";
import {
  aggregateEntries,
  buildDayDoc,
  gscDayDocId,
  sumTotals,
  GSC_TOP_LIMIT,
  GSC_SMALL_LIMIT,
  type GscApiRow,
  type GscDayDoc,
  type GscEntry,
  type GscSitemapInfo,
} from "@/lib/gsc-pure";

// ─────────────────────────────────────────────────────────────
// Google Search Console — accès API et persistance Firestore.
//
// Authentification : ADC (Application Default Credentials), exactement comme
// le client GA4 de ceo-analysis-service.ts. Sur Cloud Run, l'identité est le
// compte de service d'exécution — c'est LUI qui doit être ajouté comme
// utilisateur (autorisation « Complète » en lecture suffit) dans la propriété
// Search Console. Aucun fichier de clé, jamais.
//
// Propriété visée : env GSC_SITE_URL. Une propriété « Domaine » s'écrit
// `sc-domain:bleuh.co`, une propriété « Préfixe d'URL »
// `https://bleuh.co/`. En cas de 403, l'erreur renvoie la liste des
// propriétés réellement accessibles pour se diagnostiquer toute seule.
// ─────────────────────────────────────────────────────────────

const API_BASE = "https://searchconsole.googleapis.com/webmasters/v3";
const SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
const DEFAULT_SITE = "sc-domain:bleuh.co";

/** Archive quotidienne GSC — voir l'en-tête de src/lib/gsc-pure.ts. */
const GSC_DAILY = "gsc_daily";

export function gscSiteUrl(): string {
  return process.env.GSC_SITE_URL || DEFAULT_SITE;
}

export class GscApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly accessibleSites: string[] | null = null
  ) {
    super(message);
    this.name = "GscApiError";
  }
}

let cachedAuth: GoogleAuth | null = null;
async function accessToken(): Promise<string> {
  cachedAuth ??= new GoogleAuth({ scopes: [SCOPE] });
  const token = await cachedAuth.getAccessToken();
  if (!token) throw new GscApiError("Impossible d'obtenir un jeton Google (ADC).", 500);
  return token;
}

async function gscFetch(path: string, init?: RequestInit): Promise<unknown> {
  const token = await accessToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    let detail = body.slice(0, 300);
    try {
      detail = (JSON.parse(body) as { error?: { message?: string } }).error?.message ?? detail;
    } catch {
      /* texte brut */
    }
    // 403 = le compte de service n'est pas (ou pas encore) utilisateur de la
    // propriété. On joint les propriétés accessibles pour l'auto-diagnostic.
    const sites = res.status === 403 ? await listSites().catch(() => null) : null;
    throw new GscApiError(`Search Console ${res.status} sur ${path} : ${detail}`, res.status, sites);
  }
  return res.json();
}

/** Propriétés GSC accessibles par l'identité courante (diagnostic). */
export async function listSites(): Promise<string[]> {
  const data = (await gscFetch("/sites")) as {
    siteEntry?: { siteUrl?: string; permissionLevel?: string }[];
  };
  return (data.siteEntry ?? []).map((s) => `${s.siteUrl} (${s.permissionLevel})`);
}

async function queryRows(
  site: string,
  date: string,
  dimensions: string[],
  rowLimit: number
): Promise<GscApiRow[]> {
  const data = (await gscFetch(`/sites/${encodeURIComponent(site)}/searchAnalytics/query`, {
    method: "POST",
    body: JSON.stringify({ startDate: date, endDate: date, dimensions, rowLimit }),
  })) as { rows?: GscApiRow[] };
  return data.rows ?? [];
}

/** Instantané des sitemaps déclarés (compteurs soumis/indexés, erreurs). */
export async function fetchSitemaps(site: string = gscSiteUrl()): Promise<GscSitemapInfo[]> {
  const data = (await gscFetch(`/sites/${encodeURIComponent(site)}/sitemaps`)) as {
    sitemap?: {
      path?: string;
      lastSubmitted?: string;
      lastDownloaded?: string;
      isPending?: boolean;
      errors?: string | number;
      warnings?: string | number;
      contents?: { type?: string; submitted?: string | number; indexed?: string | number }[];
    }[];
  };
  return (data.sitemap ?? []).map((s) => {
    const contents = s.contents ?? [];
    const sum = (field: "submitted" | "indexed") =>
      contents.reduce((acc, c) => acc + Number(c[field] ?? 0), 0);
    return {
      path: s.path ?? "",
      lastSubmitted: s.lastSubmitted ?? null,
      lastDownloaded: s.lastDownloaded ?? null,
      isPending: Boolean(s.isPending),
      errors: Number(s.errors ?? 0),
      warnings: Number(s.warnings ?? 0),
      submitted: sum("submitted"),
      indexed: sum("indexed"),
    };
  });
}

/** Interroge l'API pour UN jour et construit le document (sans l'écrire). */
export async function fetchDayDoc(
  date: string,
  sitemaps: GscSitemapInfo[],
  site: string = gscSiteUrl()
): Promise<GscDayDoc> {
  // 5 requêtes séquentielles par jour — le quota (1 200/min/projet) est loin.
  const totalsRows = await queryRows(site, date, [], 1);
  const queryRowsData = await queryRows(site, date, ["query"], GSC_TOP_LIMIT);
  const pageRows = await queryRows(site, date, ["page"], GSC_TOP_LIMIT);
  const deviceRows = await queryRows(site, date, ["device"], GSC_SMALL_LIMIT);
  const countryRows = await queryRows(site, date, ["country"], GSC_SMALL_LIMIT);
  return buildDayDoc({
    date,
    siteUrl: site,
    totalsRows,
    queryRows: queryRowsData,
    pageRows,
    deviceRows,
    countryRows,
    sitemaps,
    fetchedAt: new Date().toISOString(),
  });
}

export interface GscSyncSummary {
  siteUrl: string;
  synced: string[];
  totalClicks: number;
  totalImpressions: number;
}

/**
 * Synchronise une liste de jours : lit l'API, écrit (ou réécrit — idempotent)
 * un document par jour dans la collection quotidienne.
 */
export async function syncDates(dates: string[]): Promise<GscSyncSummary> {
  const site = gscSiteUrl();
  const sitemaps = await fetchSitemaps(site);
  const coll = adminDb().collection(GSC_DAILY);
  let totalClicks = 0;
  let totalImpressions = 0;
  for (const date of dates) {
    const doc = await fetchDayDoc(date, sitemaps, site);
    await coll.doc(gscDayDocId(date)).set(doc);
    totalClicks += doc.totals.clicks;
    totalImpressions += doc.totals.impressions;
  }
  return { siteUrl: site, synced: dates, totalClicks, totalImpressions };
}

export interface GscReport {
  siteUrl: string;
  /** Série quotidienne de la période demandée, triée en ordre croissant. */
  days: { date: string; totals: GscDayDoc["totals"] }[];
  /** Totaux de la période (ctr/position repondérés par impressions). */
  totals: GscDayDoc["totals"];
  /** Totaux de la période PRÉCÉDENTE de même longueur, ou null si
      l'historique ne couvre pas une période complète (comparaison honnête
      ou pas de comparaison du tout). */
  prevTotals: GscDayDoc["totals"] | null;
  /** Tops agrégés sur la période demandée. */
  queries: GscEntry[];
  pages: GscEntry[];
  devices: GscEntry[];
  countries: GscEntry[];
  /** État des sitemaps au jour le plus récent. */
  sitemaps: GscDayDoc["sitemaps"];
  latest: GscDayDoc | null;
}

/**
 * Lit les N derniers jours stockés et agrège la période : série quotidienne
 * pour les graphiques, totaux + tops de période, et totaux de la période
 * précédente (même longueur) pour la comparaison. On lit 2×N documents en une
 * seule requête — moins cher que deux requêtes et le tri est déjà le bon.
 */
export async function readReport(days: number): Promise<GscReport> {
  const snap = await adminDb()
    .collection(GSC_DAILY)
    .orderBy("date", "desc")
    .limit(days * 2)
    .get();
  const docs = snap.docs.map((d) => d.data() as GscDayDoc);
  docs.sort((a, b) => a.date.localeCompare(b.date));
  const current = docs.slice(-days);
  const previous = docs.slice(0, Math.max(0, docs.length - days));
  return {
    siteUrl: gscSiteUrl(),
    days: current.map((d) => ({ date: d.date, totals: d.totals })),
    totals: sumTotals(current.map((d) => d.totals)),
    prevTotals: previous.length === current.length ? sumTotals(previous.map((d) => d.totals)) : null,
    queries: aggregateEntries(current.map((d) => d.queries), GSC_TOP_LIMIT),
    pages: aggregateEntries(current.map((d) => d.pages), GSC_TOP_LIMIT),
    devices: aggregateEntries(current.map((d) => d.devices), GSC_SMALL_LIMIT),
    countries: aggregateEntries(current.map((d) => d.countries), GSC_SMALL_LIMIT),
    sitemaps: current.length > 0 ? current[current.length - 1].sitemaps : [],
    latest: current.length > 0 ? current[current.length - 1] : null,
  };
}
