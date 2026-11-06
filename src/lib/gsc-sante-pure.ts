// ─────────────────────────────────────────────────────────────
// Santé Google — helpers PURS (aucune I/O). La partie réseau/Firestore vit
// dans gsc-sante-service.ts. Jumeau du module de marketing-mdh.
//
// Deux vérifications, chaque matin après l'archive Search Console :
//
// 1. Plan du site : celui qu'annonce robots.txt doit être déclaré à Google ;
//    un plan déclaré qui n'existe plus (404/410) est retiré. Rien d'autre
//    n'est touché (un plan vivant déclaré à la main reste en place).
//
// 2. Vieilles pages : chaque adresse que Google a montrée ces derniers jours
//    est relue sur le site, comme un robot. Une adresse qui ne sert plus de
//    page (introuvable, renvoyée vers l'accueil, redirigée, exclue) est
//    signalée avec ce qu'il faut faire. Les simples normalisations (http →
//    https, www, barre finale, accueil → /fr) ne sont pas des signaux.
//
// Contrat de stockage : un document par jour de vérification dans
// `gsc_sante`, id `jour_YYYY-MM-DD` ; seuls les signaux y sont gardés, pas
// les centaines de pages saines.
// ─────────────────────────────────────────────────────────────

export const GSC_SANTE_DOC_PREFIX = "jour_";

/** Jours de Search Console relus : « Google montre encore » = récemment. */
export const GSC_SANTE_WINDOW_DAYS = 7;

/** Sauts de redirection suivis avant d'abandonner (boucle ou chaîne folle). */
export const GSC_SANTE_MAX_HOPS = 5;

export type GscPageKind =
  | "introuvable"
  | "autre_hote"
  | "accueil"
  | "temporaire"
  | "noindex"
  | "deplacee"
  | "erreur";

/** Ordre d'affichage : ce qui demande une action d'abord. */
export const GSC_PAGE_KINDS: GscPageKind[] = [
  "introuvable",
  "autre_hote",
  "accueil",
  "temporaire",
  "noindex",
  "erreur",
  "deplacee",
];

/** Un saut lu sur le site : statut, et cible absolue si redirection. */
export interface ProbeHop {
  url: string;
  status: number | null;
  location: string | null;
  /** Page 200 marquée noindex (en-tête X-Robots-Tag ou balise meta). */
  noindex?: boolean;
  /** Erreur réseau ou délai dépassé. */
  error?: string;
}

export interface GscPageSignal {
  url: string;
  kind: GscPageKind;
  /** Premier statut lu sur l'adresse montrée par Google. */
  status: number | null;
  /** Où la chaîne de redirections aboutit (null si pas de redirection). */
  finalUrl: string | null;
  finalStatus: number | null;
  impressions: number;
  clicks: number;
  position: number;
  /** Dernier jour où Google l'a montrée (YYYY-MM-DD). */
  lastSeen: string;
}

export interface GscPlanSante {
  /** Plans annoncés par robots.txt. */
  expected: string[];
  /** Plans déclarés chez Google après la vérification. */
  declared: { path: string; lastDownloaded: string | null; errors: number; isPending: boolean }[];
  /** Envoyés à Google pendant cette vérification. */
  submitted: string[];
  /** Retirés de Google pendant cette vérification (n'existaient plus). */
  removed: string[];
  /** Ce qui n'a pas pu être fait, en clair. */
  problems: string[];
}

export interface GscPagesSante {
  window: { start: string; end: string };
  /** Adresses montrées par Google sur la période. */
  shown: number;
  /** Adresses relues sur le site (les plus vues d'abord). */
  checked: number;
  /** Adresses saines (page servie normalement). */
  ok: number;
  signals: GscPageSignal[];
  error: string | null;
}

export interface GscSanteDoc {
  date: string;
  siteUrl: string;
  checkedAt: string;
  plan: GscPlanSante | null;
  planError: string | null;
  pages: GscPagesSante | null;
}

export function gscSanteDocId(date: string): string {
  return `${GSC_SANTE_DOC_PREFIX}${date}`;
}

function addDaysUtc(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Les 7 derniers jours publiés par Search Console (J-8 → J-2, UTC). */
export function santeWindow(today: Date = new Date()): { start: string; end: string } {
  const end = addDaysUtc(today.toISOString().slice(0, 10), -2);
  return { start: addDaysUtc(end, -(GSC_SANTE_WINDOW_DAYS - 1)), end };
}

/** `sc-domain:bleuh.co` → `https://bleuh.co` ; `https://x.ca/` → `https://x.ca`. */
export function siteOrigin(siteUrl: string): string {
  if (siteUrl.startsWith("sc-domain:")) return `https://${siteUrl.slice("sc-domain:".length)}`;
  return new URL(siteUrl).origin;
}

/** Hôte sans `www.`, en minuscules ; null si l'adresse est illisible. */
export function bareHost(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** Lignes `Sitemap:` d'un robots.txt, sans doublon, dans l'ordre. */
export function parseRobotsSitemaps(robotsTxt: string): string[] {
  const out: string[] = [];
  for (const line of robotsTxt.split(/\r?\n/)) {
    const m = /^\s*sitemap\s*:\s*(\S+)/i.exec(line);
    if (m && /^https?:\/\//i.test(m[1]) && !out.includes(m[1])) out.push(m[1]);
  }
  return out;
}

/** Plans annoncés par robots.txt mais pas encore déclarés à Google. */
export function sitemapsToSubmit(expected: string[], declared: string[]): string[] {
  return expected.filter((u) => !declared.includes(u));
}

/**
 * Plans déclarés que robots.txt n'annonce pas : candidats au retrait, mais
 * SEULEMENT s'ils répondent 404/410 (le service relit chacun avant d'agir).
 */
export function sitemapsToRecheck(expected: string[], declared: string[]): string[] {
  return declared.filter((u) => !expected.includes(u));
}

/** Un statut qui dit « ce plan n'existe plus », sans ambiguïté. */
export function isGoneStatus(status: number | null): boolean {
  return status === 404 || status === 410;
}

/** Forme de comparaison : hôte sans www, chemin sans barre finale, requête gardée. */
function comparable(u: URL): string {
  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  const path = u.pathname.replace(/\/+$/, "") || "/";
  return `${host}${path}${u.search}`;
}

/**
 * Saut « de normalisation » : même page, autre écriture (http → https, www,
 * barre finale) ou même chemin préfixé par sa langue (`/` → `/fr`,
 * `/produit/x` → `/fr/produit/x`). Google les suit sans perdre la page : ce
 * ne sont pas des signaux.
 */
export function isNormalizationHop(from: string, to: string): boolean {
  let a: URL;
  let b: URL;
  try {
    a = new URL(from);
    b = new URL(to, from);
  } catch {
    return false;
  }
  if (comparable(a) === comparable(b)) return true;
  const sameHost =
    a.hostname.toLowerCase().replace(/^www\./, "") === b.hostname.toLowerCase().replace(/^www\./, "");
  if (!sameHost || a.search !== b.search) return false;
  const pa = a.pathname.replace(/\/+$/, "");
  const pb = b.pathname.replace(/\/+$/, "");
  const lang = /^\/[a-z]{2}(-[a-z]{2})?(?=\/|$)/i.exec(pb);
  return lang !== null && pb.slice(lang[0].length) === pa;
}

/** `/`, `/fr`, `/en/` … : l'accueil du site, toutes langues. */
export function isHomePath(url: string): boolean {
  try {
    const p = new URL(url).pathname.replace(/\/+$/, "") || "/";
    return p === "/" || /^\/[a-z]{2}(-[a-z]{2})?$/i.test(p);
  } catch {
    return false;
  }
}

const TEMPORARY = new Set([302, 303, 307]);

/**
 * Range une chaîne lue sur le site. `null` = page saine (servie en 200, ou
 * seulement normalisée vers une page servie en 200).
 *
 * `mainHost` (ex. `maisondherbes.com`) : une adresse montrée sur un AUTRE
 * hôte de la propriété (`old.maisondherbes.com`, un ancien site resté en
 * ligne) et qui y sert encore une page est un signal, même en 200. Une page
 * du site principal redirigée ailleurs suit les règles des redirections.
 */
export function classifyChain(
  hops: ProbeHop[],
  mainHost: string | null = null
): Pick<GscPageSignal, "kind" | "status" | "finalUrl" | "finalStatus"> | null {
  if (hops.length === 0) return null;
  const first = hops[0];
  const last = hops[hops.length - 1];
  const redirects = hops.slice(0, -1);
  const finalUrl = redirects.length > 0 ? last.url : null;
  const base = { status: first.status, finalUrl, finalStatus: last.status };

  if (last.error || last.status === null) return { kind: "erreur", ...base };
  if (isGoneStatus(last.status)) return { kind: "introuvable", ...base };
  // Encore une redirection au dernier saut = chaîne trop longue ou boucle.
  if (last.status >= 300 && last.status < 400) return { kind: "erreur", ...base };
  if (last.status !== 200) return { kind: "erreur", ...base };
  if (last.noindex) return { kind: "noindex", ...base };
  if (mainHost && bareHost(first.url) !== mainHost && bareHost(last.url) !== mainHost) {
    return { kind: "autre_hote", ...base };
  }

  const real = redirects.filter((h) => h.location && !isNormalizationHop(h.url, h.location));
  if (real.length === 0) return null;
  // L'accueil DU SITE (pas celui d'un autre domaine, ex. bleuh.shop).
  const lastHost = bareHost(last.url);
  const ownHome = lastHost === (mainHost ?? bareHost(first.url)) || lastHost === bareHost(first.url);
  if (ownHome && isHomePath(last.url) && !isHomePath(first.url)) return { kind: "accueil", ...base };
  if (real.some((h) => h.status !== null && TEMPORARY.has(h.status))) {
    return { kind: "temporaire", ...base };
  }
  return { kind: "deplacee", ...base };
}

/** `<meta name="robots" content="…noindex…">` (ou googlebot) dans un début de HTML. */
export function htmlHasNoindex(html: string): boolean {
  const metas = html.match(/<meta\b[^>]*>/gi) ?? [];
  return metas.some(
    (m) => /\bname\s*=\s*["']?(robots|googlebot)["']?/i.test(m) && /\bnoindex\b/i.test(m)
  );
}

/** En-tête `X-Robots-Tag` qui exclut la page (toutes cibles ou googlebot). */
export function headerHasNoindex(value: string | null): boolean {
  if (!value) return false;
  return value
    .split(",")
    .some((part) => /\bnoindex\b/i.test(part) && (!/:/.test(part) || /^\s*googlebot\s*:/i.test(part)));
}

/** Ligne brute de searchanalytics.query avec dimensions [page, date]. */
export interface PageDateRow {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  position?: number;
}

export interface ShownPage {
  url: string;
  impressions: number;
  clicks: number;
  position: number;
  lastSeen: string;
}

/**
 * Regroupe les lignes [page, date] par adresse : impressions et clics
 * additionnés, position repondérée par les impressions, dernier jour vu.
 * Triées par impressions : le budget de relecture va aux plus visibles.
 */
export function aggregateShownPages(rows: PageDateRow[]): ShownPage[] {
  const map = new Map<string, { i: number; c: number; pw: number; last: string }>();
  for (const r of rows) {
    const [url, date] = r.keys ?? [];
    if (!url || !date) continue;
    const acc = map.get(url) ?? { i: 0, c: 0, pw: 0, last: "" };
    const imp = r.impressions ?? 0;
    acc.i += imp;
    acc.c += r.clicks ?? 0;
    acc.pw += (r.position ?? 0) * imp;
    if (date > acc.last) acc.last = date;
    map.set(url, acc);
  }
  return [...map.entries()]
    .map(([url, a]) => ({
      url,
      impressions: a.i,
      clicks: a.c,
      position: a.i > 0 ? Math.round((a.pw / a.i) * 10) / 10 : 0,
      lastSeen: a.last,
    }))
    .sort((a, b) => b.impressions - a.impressions || b.clicks - a.clicks);
}

/** Signaux triés : par gravité (ordre de GSC_PAGE_KINDS), puis impressions. */
export function sortSignals(signals: GscPageSignal[]): GscPageSignal[] {
  const rank = (k: GscPageKind) => GSC_PAGE_KINDS.indexOf(k);
  return [...signals].sort((a, b) => rank(a.kind) - rank(b.kind) || b.impressions - a.impressions);
}

/** Lien Search Console d'une propriété (le seul lien direct qui marche). */
export function searchConsoleUrl(siteUrl: string, section: "" | "removals" | "sitemaps" = ""): string {
  const base = "https://search.google.com/search-console";
  return `${base}${section ? `/${section}` : ""}?resource_id=${encodeURIComponent(siteUrl)}`;
}
