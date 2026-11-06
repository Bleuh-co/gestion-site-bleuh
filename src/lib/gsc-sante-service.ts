import "server-only";
import { adminDb } from "@/lib/firebase-admin";
import { fetchSitemaps, gscFetch, gscSiteUrl } from "@/lib/gsc-service";
import {
  GSC_SANTE_MAX_HOPS,
  aggregateShownPages,
  bareHost,
  classifyChain,
  gscSanteDocId,
  headerHasNoindex,
  htmlHasNoindex,
  isGoneStatus,
  isTransientStatus,
  parseRobotsSitemaps,
  santeWindow,
  siteOrigin,
  sitemapsToRecheck,
  sitemapsToSubmit,
  sortSignals,
  type GscPageSignal,
  type GscPagesSante,
  type GscPlanSante,
  type GscSanteDoc,
  type PageDateRow,
  type ProbeHop,
  type ShownPage,
} from "@/lib/gsc-sante-pure";

// ─────────────────────────────────────────────────────────────
// Santé Google — partie réseau et Firestore. Les règles vivent dans
// gsc-sante-pure.ts (testées) ; ici, on lit le site comme un robot, on
// interroge Search Console et on écrit le résultat du jour.
//
// Lancé chaque matin par Cloud Scheduler (`bleuh-gsc-sante`, POST
// /api/gsc/sante) et à la demande depuis l'écran Performance Google.
// ─────────────────────────────────────────────────────────────

const GSC_SANTE = "gsc_sante";

/**
 * Agent annoncé au site. Pas « Googlebot » (Cloudflare bloque les faux), et
 * pas « Mozilla/5.0 (compatible; …) » : l'ancien WordPress de
 * old.maisondherbes.com répond 520 à cette forme (relevé du 06/11/2026).
 */
const USER_AGENT = "MarketingBleuh-VerifGoogle/1.0 (+https://gandalf.chanv.com)";
const PROBE_TIMEOUT_MS = 15_000;
/** Attente avant de relire une réponse peut-être passagère (pare-feu, surcharge). */
const RETRY_DELAY_MS = 2_000;
/** Trois lectures à la fois : 12 en parallèle font tomber maisondherbes.com en délai. */
const PROBE_CONCURRENCY = 3;
/** Budget de relecture des pages : la requête entière doit tenir dans 300 s. */
const PROBE_BUDGET_MS = 180_000;
/** Assez pour lire le <head> d'une page Next (les balises meta y sont tôt). */
const HTML_SCAN_BYTES = 256 * 1024;
/** Plafond du document Firestore (1 Mo) : ~250 octets par signal. */
const MAX_SIGNALS = 1000;
const ROWS_PER_QUERY = 25_000;

function message(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** Début du HTML, jusqu'à </head> ou HTML_SCAN_BYTES. */
async function readHead(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder();
  let html = "";
  let bytes = 0;
  try {
    while (bytes < HTML_SCAN_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      html += decoder.decode(value, { stream: true });
      if (/<\/head>/i.test(html)) break;
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return html;
}

/** Lit UNE adresse sans suivre la redirection. */
async function probeOnce(url: string): Promise<ProbeHop> {
  try {
    const res = await fetch(url, {
      redirect: "manual",
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml,*/*;q=0.8" },
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      cache: "no-store",
    });
    const location = res.headers.get("location");
    let noindex = headerHasNoindex(res.headers.get("x-robots-tag"));
    if (res.status === 200 && !noindex && (res.headers.get("content-type") ?? "").includes("html")) {
      noindex = htmlHasNoindex(await readHead(res));
    } else {
      await res.body?.cancel().catch(() => {});
    }
    return {
      url,
      status: res.status,
      location: location ? new URL(location, url).toString() : null,
      noindex,
    };
  } catch (e) {
    return { url, status: null, location: null, error: message(e) };
  }
}

/** Lit une adresse ; une réponse peut-être passagère est relue une fois. */
async function probeSteady(url: string): Promise<ProbeHop> {
  const hop = await probeOnce(url);
  if (!isTransientStatus(hop.status)) return hop;
  await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
  return probeOnce(url);
}

/** Suit les redirections saut par saut ; s'arrête sur une boucle. */
async function probeChain(url: string): Promise<ProbeHop[]> {
  const hops: ProbeHop[] = [];
  const seen = new Set<string>();
  let current = url;
  while (hops.length < GSC_SANTE_MAX_HOPS) {
    seen.add(current);
    const hop = await probeSteady(current);
    hops.push(hop);
    const redirect = hop.status !== null && hop.status >= 300 && hop.status < 400;
    if (!redirect || !hop.location || seen.has(hop.location)) break;
    current = hop.location;
  }
  return hops;
}

/**
 * Plan du site : déclare à Google celui qu'annonce robots.txt, retire les
 * plans déclarés qui n'existent plus. Un robots.txt illisible = on ne touche
 * à rien.
 */
async function checkPlan(site: string): Promise<GscPlanSante> {
  const enc = encodeURIComponent;
  const problems: string[] = [];
  const robotsUrl = `${siteOrigin(site)}/robots.txt`;
  const robots = await fetch(robotsUrl, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    cache: "no-store",
  });
  if (!robots.ok) {
    throw new Error(`${robotsUrl} répond ${robots.status} : plan du site non vérifié, rien n'a été touché.`);
  }
  const expected = parseRobotsSitemaps(await robots.text());
  if (expected.length === 0) problems.push(`${robotsUrl} n'annonce aucun plan du site.`);

  const before = await fetchSitemaps(site);
  const declared = before.map((s) => s.path);
  const submitted: string[] = [];
  const removed: string[] = [];

  for (const url of sitemapsToSubmit(expected, declared)) {
    const hop = await probeOnce(url);
    if (hop.status !== 200) {
      problems.push(`${url} est annoncé par robots.txt mais répond ${hop.status ?? hop.error} : pas envoyé à Google.`);
      continue;
    }
    try {
      await gscFetch(`/sites/${enc(site)}/sitemaps/${enc(url)}`, { method: "PUT" });
      submitted.push(url);
    } catch (e) {
      problems.push(`Envoi de ${url} refusé par Google : ${message(e)}`);
    }
  }

  for (const url of sitemapsToRecheck(expected, declared)) {
    const hop = await probeOnce(url);
    if (!isGoneStatus(hop.status)) continue; // vivant ou douteux : on n'y touche pas
    try {
      await gscFetch(`/sites/${enc(site)}/sitemaps/${enc(url)}`, { method: "DELETE" });
      removed.push(url);
    } catch (e) {
      problems.push(`Retrait de ${url} refusé par Google : ${message(e)}`);
    }
  }

  const after = submitted.length > 0 || removed.length > 0 ? await fetchSitemaps(site) : before;
  return {
    expected,
    declared: after.map((s) => ({
      path: s.path,
      lastDownloaded: s.lastDownloaded,
      errors: s.errors,
      isPending: s.isPending,
    })),
    submitted,
    removed,
    problems,
  };
}

/** Toutes les adresses montrées par Google sur la période, les plus vues d'abord. */
async function shownPages(site: string, start: string, end: string): Promise<ShownPage[]> {
  const rows: PageDateRow[] = [];
  for (let startRow = 0; ; startRow += ROWS_PER_QUERY) {
    const data = (await gscFetch(`/sites/${encodeURIComponent(site)}/searchAnalytics/query`, {
      method: "POST",
      body: JSON.stringify({
        startDate: start,
        endDate: end,
        dimensions: ["page", "date"],
        rowLimit: ROWS_PER_QUERY,
        startRow,
      }),
    })) as { rows?: PageDateRow[] } | null;
    const got = data?.rows ?? [];
    rows.push(...got);
    if (got.length < ROWS_PER_QUERY) break;
  }
  return aggregateShownPages(rows);
}

/** Relit les pages sur le site, quelques-unes à la fois, jusqu'au budget. */
async function checkPages(site: string, now: Date): Promise<GscPagesSante> {
  const window = santeWindow(now);
  const pages = await shownPages(site, window.start, window.end);
  const mainHost = bareHost(siteOrigin(site));
  const deadline = Date.now() + PROBE_BUDGET_MS;
  const signals: GscPageSignal[] = [];
  let next = 0;
  let checked = 0;
  let ok = 0;
  const worker = async () => {
    while (next < pages.length && Date.now() < deadline) {
      const page = pages[next++];
      const verdict = classifyChain(await probeChain(page.url), mainHost);
      checked++;
      if (!verdict) {
        ok++;
        continue;
      }
      signals.push({
        url: page.url,
        ...verdict,
        impressions: page.impressions,
        clicks: page.clicks,
        position: page.position,
        lastSeen: page.lastSeen,
      });
    }
  };
  await Promise.all(Array.from({ length: PROBE_CONCURRENCY }, worker));
  return {
    window,
    shown: pages.length,
    checked,
    ok,
    signals: sortSignals(signals).slice(0, MAX_SIGNALS),
    error: null,
  };
}

/** Vérification complète du jour, écrite dans Firestore (réécrite si relancée). */
export async function runSante(now: Date = new Date()): Promise<GscSanteDoc> {
  const site = gscSiteUrl();
  let plan: GscPlanSante | null = null;
  let planError: string | null = null;
  try {
    plan = await checkPlan(site);
  } catch (e) {
    planError = message(e);
  }
  let pages: GscPagesSante;
  try {
    pages = await checkPages(site, now);
  } catch (e) {
    pages = { window: santeWindow(now), shown: 0, checked: 0, ok: 0, signals: [], error: message(e) };
  }
  const doc: GscSanteDoc = {
    date: now.toISOString().slice(0, 10),
    siteUrl: site,
    checkedAt: now.toISOString(),
    plan,
    planError,
    pages,
  };
  await adminDb().collection(GSC_SANTE).doc(gscSanteDocId(doc.date)).set(doc);
  return doc;
}

/** Dernière vérification enregistrée, ou null. */
export async function readSante(): Promise<GscSanteDoc | null> {
  const snap = await adminDb().collection(GSC_SANTE).orderBy("date", "desc").limit(1).get();
  return snap.empty ? null : (snap.docs[0].data() as GscSanteDoc);
}
