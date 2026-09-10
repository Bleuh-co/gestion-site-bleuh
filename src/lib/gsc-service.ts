import "server-only";
import { GoogleAuth } from "google-auth-library";
import { adminDb } from "@/lib/firebase-admin";
import {
  buildDayDoc,
  gscDayDocId,
  GSC_TOP_LIMIT,
  GSC_SMALL_LIMIT,
  type GscApiRow,
  type GscDayDoc,
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
  days: { date: string; totals: GscDayDoc["totals"] }[];
  latest: GscDayDoc | null;
}

/** Lit les N derniers jours stockés (série pour graphiques + détail du plus récent). */
export async function readReport(days: number): Promise<GscReport> {
  const snap = await adminDb()
    .collection(GSC_DAILY)
    .orderBy("date", "desc")
    .limit(days)
    .get();
  const docs = snap.docs.map((d) => d.data() as GscDayDoc);
  docs.sort((a, b) => a.date.localeCompare(b.date));
  return {
    siteUrl: gscSiteUrl(),
    days: docs.map((d) => ({ date: d.date, totals: d.totals })),
    latest: docs.length > 0 ? docs[docs.length - 1] : null,
  };
}
