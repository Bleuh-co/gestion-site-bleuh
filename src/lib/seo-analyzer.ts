import "server-only";
import { parse, type HTMLElement } from "node-html-parser";
import type {
  SeoReport,
  SeoPageResult,
  SeoIssue,
  SeoTechnical,
  SeoSeverity,
  SeoRecommendation,
  SeoAnalyseResult,
} from "./seo-types";

// ─────────────────────────────────────────────────────────────
// Analyseur SEO du site public SiteBleuh (Next.js SSR bilingue FR/EN).
//
// On audite le HTML rendu SERVEUR — celui que voit Googlebot. L'age-gate du
// site est un overlay client : il n'altère pas le HTML serveur, donc les
// balises meta y sont déjà présentes. Aucun rendu JS ici : simple fetch + parse.
//
// Robustesse : jamais throw sur une page en échec (on marque `error`), crawl
// borné (MAX_PAGES), timeout par requête. Aucune clé/secret manipulé ici.
// ─────────────────────────────────────────────────────────────

const DEFAULT_BASE_URL = "https://sitebleuh-fkdfx4bpva-ue.a.run.app";
const MAX_PAGES = 25;
const FETCH_TIMEOUT_MS = 8000;
const THIN_CONTENT_WORDS = 150;
const USER_AGENT = "BleuhSeoBot/1.0 (+gestion-site-bleuh)";

function baseUrl(): string {
  return (process.env.SITEBLEUH_PUBLIC_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
}

interface FetchResult {
  status: number;
  ok: boolean;
  body: string;
  responseMs: number;
  error: string | null;
}

/** Fetch borné dans le temps, ne throw jamais (renvoie error dans le résultat). */
async function safeFetch(url: string, accept = "text/html"): Promise<FetchResult> {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": USER_AGENT, Accept: accept },
      cache: "no-store",
    });
    const body = await res.text();
    return {
      status: res.status,
      ok: res.ok,
      body,
      responseMs: Date.now() - started,
      error: null,
    };
  } catch (e) {
    return {
      status: 0,
      ok: false,
      body: "",
      responseMs: Date.now() - started,
      error: e instanceof Error ? e.message : "fetch failed",
    };
  } finally {
    clearTimeout(timer);
  }
}

// ── Volet technique ──────────────────────────────────────────

async function checkRobots(base: string) {
  const r = await safeFetch(`${base}/robots.txt`, "text/plain");
  const present = r.ok && r.status < 400 && /user-agent/i.test(r.body);
  return {
    present,
    status: r.status,
    hasSitemapRef: /^\s*sitemap\s*:/im.test(r.body),
  };
}

async function checkSitemap(base: string) {
  const r = await safeFetch(`${base}/sitemap.xml`, "application/xml");
  const present = r.ok && r.status < 400 && /<urlset|<sitemapindex/i.test(r.body);
  const urls = present ? extractSitemapUrls(r.body) : [];
  return { present, status: r.status, urlCount: urls.length, urls };
}

function extractSitemapUrls(xml: string): string[] {
  const out: string[] = [];
  const re = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    out.push(m[1].trim());
  }
  return out;
}

// ── Découverte de pages ──────────────────────────────────────

function isInternal(base: string, url: string): boolean {
  try {
    const u = new URL(url, base);
    return u.origin === new URL(base).origin;
  } catch {
    return false;
  }
}

/** Extrait les liens internes (fiches produit prioritaires) d'un HTML de listing. */
function extractInternalLinks(base: string, html: string): string[] {
  const root = parse(html);
  const found = new Set<string>();
  for (const a of root.querySelectorAll("a[href]")) {
    const href = a.getAttribute("href");
    if (!href || href.startsWith("#") || href.startsWith("mailto:")) continue;
    if (!isInternal(base, href)) continue;
    try {
      const u = new URL(href, base);
      u.hash = "";
      found.add(u.toString());
    } catch {
      /* lien mal formé : ignoré */
    }
  }
  return [...found];
}

/** Priorise les fiches produit puis les pages FR/EN, borne à MAX_PAGES. */
function selectPages(base: string, seeds: string[], discovered: string[]): string[] {
  const isProduct = (u: string) => /\/(produit|product)\//.test(u);
  const ordered = [
    ...seeds,
    ...discovered.filter(isProduct),
    ...discovered.filter((u) => !isProduct(u)),
  ];
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const u of ordered) {
    const norm = u.replace(/\/+$/, "") || base;
    if (seen.has(norm)) continue;
    seen.add(norm);
    unique.push(u);
    if (unique.length >= MAX_PAGES) break;
  }
  return unique;
}

// ── Analyse d'une page ───────────────────────────────────────

function attr(root: HTMLElement, selector: string, name: string): string | null {
  const el = root.querySelector(selector);
  return el ? el.getAttribute(name) ?? null : null;
}

function analyzeHtml(url: string, res: FetchResult): SeoPageResult {
  const base: SeoPageResult = {
    url,
    status: res.status,
    error: res.error,
    responseMs: res.responseMs,
    title: { present: false, text: "", length: 0 },
    metaDescription: { present: false, text: "", length: 0 },
    h1Count: 0,
    canonical: { present: false, value: null },
    hreflang: { present: false, langs: [] },
    metaRobots: { present: false, value: null, noindex: false },
    images: { total: 0, missingAlt: 0 },
    jsonLd: { blocks: 0, types: [] },
    openGraph: { title: false, description: false, image: false },
    twitterCard: false,
    wordCount: 0,
    thinContent: true,
  };

  if (res.error || !res.body) return base;

  let root: HTMLElement;
  try {
    root = parse(res.body);
  } catch (e) {
    return { ...base, error: e instanceof Error ? e.message : "parse failed" };
  }

  // Title
  const titleEl = root.querySelector("title");
  const titleText = titleEl ? titleEl.textContent.trim() : "";
  base.title = { present: !!titleText, text: titleText, length: titleText.length };

  // Meta description
  const desc = attr(root, 'meta[name="description"]', "content")?.trim() ?? "";
  base.metaDescription = { present: !!desc, text: desc, length: desc.length };

  // H1
  base.h1Count = root.querySelectorAll("h1").length;

  // Canonical
  const canonical = attr(root, 'link[rel="canonical"]', "href");
  base.canonical = { present: !!canonical, value: canonical };

  // hreflang
  const langs: string[] = [];
  for (const link of root.querySelectorAll('link[rel="alternate"][hreflang]')) {
    const hl = link.getAttribute("hreflang");
    if (hl) langs.push(hl.toLowerCase());
  }
  base.hreflang = { present: langs.length > 0, langs: [...new Set(langs)] };

  // meta robots
  const robots = attr(root, 'meta[name="robots"]', "content");
  base.metaRobots = {
    present: !!robots,
    value: robots,
    noindex: !!robots && /noindex/i.test(robots),
  };

  // Images / alt
  const imgs = root.querySelectorAll("img");
  let missingAlt = 0;
  for (const img of imgs) {
    const alt = img.getAttribute("alt");
    if (alt === undefined || alt === null || alt.trim() === "") missingAlt++;
  }
  base.images = { total: imgs.length, missingAlt };

  // JSON-LD
  const types = new Set<string>();
  let blocks = 0;
  for (const script of root.querySelectorAll('script[type="application/ld+json"]')) {
    blocks++;
    collectJsonLdTypes(script.textContent, types);
  }
  base.jsonLd = { blocks, types: [...types] };

  // Open Graph
  base.openGraph = {
    title: !!attr(root, 'meta[property="og:title"]', "content"),
    description: !!attr(root, 'meta[property="og:description"]', "content"),
    image: !!attr(root, 'meta[property="og:image"]', "content"),
  };

  // Twitter card
  base.twitterCard = !!attr(root, 'meta[name="twitter:card"]', "content");

  // Word count (texte visible approx : on retire scripts/styles)
  for (const el of root.querySelectorAll("script,style,noscript")) el.remove();
  const text = root.textContent.replace(/\s+/g, " ").trim();
  const words = text ? text.split(" ").filter(Boolean).length : 0;
  base.wordCount = words;
  base.thinContent = words < THIN_CONTENT_WORDS;

  return base;
}

function collectJsonLdTypes(raw: string, into: Set<string>): void {
  const txt = raw.trim();
  if (!txt) return;
  try {
    const data = JSON.parse(txt);
    const nodes = Array.isArray(data) ? data : data["@graph"] && Array.isArray(data["@graph"]) ? data["@graph"] : [data];
    for (const node of nodes) {
      const t = node && (node as Record<string, unknown>)["@type"];
      if (typeof t === "string") into.add(t);
      else if (Array.isArray(t)) t.forEach((x) => typeof x === "string" && into.add(x));
    }
  } catch {
    /* JSON-LD invalide : on l'ignore (le bloc est quand même compté) */
  }
}

// ── Agrégation site-wide + issues + score ────────────────────

function buildIssues(
  tech: SeoTechnical,
  pages: SeoPageResult[],
  summary: SeoReport["summary"]
): SeoIssue[] {
  const issues: SeoIssue[] = [];
  const sample = (pred: (p: SeoPageResult) => boolean) =>
    pages.filter(pred).slice(0, 5).map((p) => p.url);

  const push = (
    id: string,
    severity: SeoSeverity,
    title: string,
    detail: string,
    pagesAffected: number,
    sampleUrls?: string[]
  ) => {
    if (pagesAffected > 0 || id === "robots-missing" || id === "sitemap-missing")
      issues.push({ id, severity, title, detail, pagesAffected, sampleUrls });
  };

  if (!tech.robotsTxt.present)
    push("robots-missing", "critique", "robots.txt absent ou invalide",
      `robots.txt renvoie le statut ${tech.robotsTxt.status}. Sans lui, aucune directive de crawl ni référence de sitemap.`, 0);

  if (!tech.sitemapXml.present)
    push("sitemap-missing", "critique", "sitemap.xml absent ou invalide",
      `sitemap.xml renvoie le statut ${tech.sitemapXml.status}. Un sitemap accélère et fiabilise l'indexation.`, 0);

  if (!tech.https)
    push("no-https", "critique", "Le site n'est pas servi en HTTPS", "L'URL de base n'utilise pas HTTPS.", 0);

  push("missing-title", "critique", "Pages sans balise <title>",
    "Le title est le signal on-page le plus fort et le libellé du résultat.",
    summary.pagesMissingTitle, sample((p) => !p.title.present && !p.error));

  push("missing-meta-desc", "moyenne", "Pages sans meta description",
    "Sans meta description, Google génère un extrait arbitraire.",
    summary.pagesMissingMetaDescription, sample((p) => !p.metaDescription.present && !p.error));

  push("duplicate-title", "moyenne", "Titres dupliqués entre pages",
    "Des titles identiques sur plusieurs pages nuisent à la différenciation dans les SERP.",
    summary.duplicateTitles);

  push("duplicate-meta-desc", "info", "Meta descriptions dupliquées",
    "Des descriptions identiques réduisent la pertinence perçue par page.",
    summary.duplicateMetaDescriptions);

  push("missing-canonical", "moyenne", "Pages sans URL canonique",
    "Sans canonical, le risque de contenu dupliqué (FR/EN, paramètres) augmente.",
    summary.pagesMissingCanonical, sample((p) => !p.canonical.present && !p.error));

  push("missing-hreflang", "moyenne", "Pages sans alternates hreflang",
    "Site bilingue FR/EN : hreflang aide Google à servir la bonne langue.",
    summary.pagesMissingHreflang, sample((p) => !p.hreflang.present && !p.error));

  push("missing-jsonld", "moyenne", "Pages sans donnée structurée JSON-LD",
    "JSON-LD (Product sur les fiches) débloque les rich snippets.",
    summary.pagesMissingJsonLd, sample((p) => p.jsonLd.blocks === 0 && !p.error));

  const noProductSchema = pages.filter(
    (p) => /\/(produit|product)\//.test(p.url) && !p.error && !p.jsonLd.types.includes("Product")
  );
  push("product-no-schema", "moyenne", "Fiches produit sans schéma Product",
    "Les fiches produit devraient exposer un JSON-LD @type Product pour les rich snippets.",
    noProductSchema.length, noProductSchema.slice(0, 5).map((p) => p.url));

  const multiH1 = pages.filter((p) => p.h1Count !== 1 && !p.error);
  push("h1-count", "info", "Pages sans H1 unique",
    "L'idéal est exactement un H1 par page.",
    multiH1.length, multiH1.slice(0, 5).map((p) => p.url));

  push("noindex", "critique", "Pages en noindex",
    "Une balise robots noindex exclut la page de l'index Google.",
    summary.pagesWithNoindex, sample((p) => p.metaRobots.noindex));

  const noOg = pages.filter((p) => !p.openGraph.title && !p.error);
  push("missing-og", "info", "Pages sans Open Graph",
    "og:title/description/image améliorent les aperçus de partage social.",
    noOg.length, noOg.slice(0, 5).map((p) => p.url));

  const imgNoAlt = pages.filter((p) => p.images.missingAlt > 0 && !p.error);
  push("img-alt", "info", "Images sans attribut alt",
    "Le texte alternatif aide l'accessibilité et le référencement image.",
    imgNoAlt.length, imgNoAlt.slice(0, 5).map((p) => p.url));

  push("thin-content", "info", "Pages au contenu mince (<150 mots)",
    "Un contenu très court peut être jugé peu utile.",
    summary.pagesThinContent, sample((p) => p.thinContent && !p.error));

  push("page-error", "moyenne", "Pages en erreur au crawl",
    "Ces URLs n'ont pas pu être analysées (statut non-2xx ou erreur réseau).",
    summary.pagesWithError, sample((p) => !!p.error || p.status >= 400));

  const order: Record<SeoSeverity, number> = { critique: 0, moyenne: 1, info: 2 };
  return issues.sort((a, b) => order[a.severity] - order[b.severity]);
}

function computeScore(tech: SeoTechnical, summary: SeoReport["summary"], pageCount: number): number {
  const n = Math.max(pageCount, 1);
  let score = 100;
  // Technique (pondération forte)
  if (!tech.robotsTxt.present) score -= 12;
  if (!tech.sitemapXml.present) score -= 12;
  if (!tech.https) score -= 15;
  // On-page proportionnel au taux de pages fautives
  score -= (summary.pagesMissingTitle / n) * 15;
  score -= (summary.pagesMissingMetaDescription / n) * 8;
  score -= (summary.pagesMissingCanonical / n) * 8;
  score -= (summary.pagesMissingHreflang / n) * 6;
  score -= (summary.pagesMissingJsonLd / n) * 8;
  score -= (summary.pagesWithNoindex / n) * 10;
  score -= (summary.duplicateTitles / n) * 6;
  score -= (summary.duplicateMetaDescriptions / n) * 3;
  score -= (summary.pagesThinContent / n) * 4;
  score -= (summary.pagesWithError / n) * 8;
  return Math.max(0, Math.min(100, Math.round(score)));
}

// ── Orchestration ────────────────────────────────────────────

/** Lance un scan SEO complet du site public. Ne throw jamais par page. */
export async function runSeoScan(): Promise<SeoReport> {
  const base = baseUrl();
  const https = base.startsWith("https://");

  const [robotsTxt, sitemapXml, homeRes] = await Promise.all([
    checkRobots(base),
    checkSitemap(base),
    safeFetch(`${base}/fr`),
  ]);

  const technical: SeoTechnical = {
    baseUrl: base,
    https,
    robotsTxt,
    sitemapXml: { present: sitemapXml.present, status: sitemapXml.status, urlCount: sitemapXml.urlCount },
    home: { status: homeRes.status, responseMs: homeRes.responseMs, htmlBytes: Buffer.byteLength(homeRes.body) },
  };

  // Découverte des pages à scanner.
  const seeds = [`${base}/fr`, `${base}/en`];
  let discovered: string[] = [];
  if (sitemapXml.present && sitemapXml.urls.length > 0) {
    discovered = sitemapXml.urls.filter((u) => isInternal(base, u));
  } else if (homeRes.body) {
    discovered = extractInternalLinks(base, homeRes.body);
  }
  const targets = selectPages(base, seeds, discovered);

  // Scan séquentiel (respecte l'origine, borné). On réutilise le HTML home déjà récupéré.
  const pages: SeoPageResult[] = [];
  for (const url of targets) {
    const norm = url.replace(/\/+$/, "");
    const res =
      norm === `${base}/fr` ? homeRes : await safeFetch(url);
    pages.push(analyzeHtml(url, res));
  }

  // Agrégation site-wide.
  const good = pages.filter((p) => !p.error && p.status < 400);
  const titleCounts = new Map<string, number>();
  const descCounts = new Map<string, number>();
  for (const p of good) {
    if (p.title.present) titleCounts.set(p.title.text, (titleCounts.get(p.title.text) ?? 0) + 1);
    if (p.metaDescription.present)
      descCounts.set(p.metaDescription.text, (descCounts.get(p.metaDescription.text) ?? 0) + 1);
  }
  const dupTitles = [...titleCounts.values()].filter((c) => c > 1).reduce((a, c) => a + c, 0);
  const dupDescs = [...descCounts.values()].filter((c) => c > 1).reduce((a, c) => a + c, 0);

  const summary: SeoReport["summary"] = {
    pagesMissingTitle: good.filter((p) => !p.title.present).length,
    pagesMissingMetaDescription: good.filter((p) => !p.metaDescription.present).length,
    duplicateTitles: dupTitles,
    duplicateMetaDescriptions: dupDescs,
    pagesMissingCanonical: good.filter((p) => !p.canonical.present).length,
    pagesMissingHreflang: good.filter((p) => !p.hreflang.present).length,
    pagesMissingJsonLd: good.filter((p) => p.jsonLd.blocks === 0).length,
    pagesWithNoindex: good.filter((p) => p.metaRobots.noindex).length,
    pagesThinContent: good.filter((p) => p.thinContent).length,
    pagesWithError: pages.filter((p) => !!p.error || p.status >= 400).length,
  };

  const issues = buildIssues(technical, pages, summary);
  const score = computeScore(technical, summary, good.length);

  return {
    generatedAt: new Date().toISOString(),
    baseUrl: base,
    score,
    technical,
    pagesScanned: pages.length,
    pages,
    issues,
    summary,
  };
}

// ─────────────────────────────────────────────────────────────
// Synthèse IA — recommandations SEO priorisées à partir du dernier rapport.
// Réutilise le client Anthropic du module CEO (même SDK, même clé). Ne reçoit
// QUE les faits mesurés (score, technique, issues agrégées) — jamais de HTML
// brut. Dégradation propre sans clé : summary/recommendations vides, pas de crash.
// ─────────────────────────────────────────────────────────────

const SEO_AI_MODEL = "claude-sonnet-4-6";

const SEO_AI_SYSTEM_PROMPT = `Tu es un consultant SEO technique qui audite un site VITRINE/catalogue bilingue FR/EN (Next.js SSR). Le site fait découvrir des produits puis redirige vers des détaillants provinciaux ; il ne vend rien directement.
Règles strictes :
- Ne t'appuie QUE sur les faits (score, volet technique, issues agrégées) fournis dans le message. N'invente aucun chiffre ni aucune URL.
- INTERDICTION ABSOLUE de toute allégation de santé, de bénéfice thérapeutique ou de dosage. Reste sur le SEO technique et éditorial neutre.
- Priorise concret et actionnable : robots.txt/sitemap.xml manquants, JSON-LD Product sur les fiches, hreflang FR/EN, canonical, titles/meta descriptions uniques, contenu mince.
- Chaque recommandation doit être une action technique précise, pas une généralité.
Réponds STRICTEMENT en JSON valide, sans texte hors JSON, au format :
{"summary": "2-4 phrases de synthèse factuelle", "recommendations": [{"priorite": "haute|moyenne|basse", "action": "...", "pourquoi": "..."}]}`;

function reportToAiPayload(report: SeoReport) {
  return {
    baseUrl: report.baseUrl,
    scoreSur100: report.score,
    pagesAnalysees: report.pagesScanned,
    technique: {
      https: report.technical.https,
      robotsTxtPresent: report.technical.robotsTxt.present,
      robotsTxtStatus: report.technical.robotsTxt.status,
      sitemapPresent: report.technical.sitemapXml.present,
      sitemapStatus: report.technical.sitemapXml.status,
      sitemapNbUrls: report.technical.sitemapXml.urlCount,
      homeTempsReponseMs: report.technical.home.responseMs,
    },
    recapPages: report.summary,
    problemes: report.issues.map((i) => ({
      severite: i.severity,
      titre: i.title,
      pagesConcernees: i.pagesAffected,
    })),
  };
}

function parseAiJson(text: string): { summary: string | null; recommendations: SeoRecommendation[] } {
  const empty = { summary: null as string | null, recommendations: [] as SeoRecommendation[] };
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return empty;
  try {
    const data = JSON.parse(match[0]) as {
      summary?: unknown;
      recommendations?: unknown;
    };
    const summary = typeof data.summary === "string" ? data.summary.trim() : null;
    const recs: SeoRecommendation[] = Array.isArray(data.recommendations)
      ? data.recommendations
          .map((r): SeoRecommendation | null => {
            if (!r || typeof r !== "object") return null;
            const o = r as Record<string, unknown>;
            const priorite =
              o.priorite === "haute" || o.priorite === "moyenne" || o.priorite === "basse"
                ? o.priorite
                : "moyenne";
            const action = typeof o.action === "string" ? o.action.trim() : "";
            const pourquoi = typeof o.pourquoi === "string" ? o.pourquoi.trim() : "";
            return action ? { priorite, action, pourquoi } : null;
          })
          .filter((r): r is SeoRecommendation => r !== null)
      : [];
    return { summary, recommendations: recs };
  } catch {
    return empty;
  }
}

/** Génère des recommandations SEO priorisées à partir d'un rapport existant. */
export async function runSeoAiAnalysis(report: SeoReport): Promise<SeoAnalyseResult> {
  const generatedAt = new Date().toISOString();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const fallback: SeoAnalyseResult = {
    generatedAt,
    model: SEO_AI_MODEL,
    basedOnReportAt: report.generatedAt ?? null,
    summary: null,
    recommendations: [],
  };
  if (!apiKey) return fallback;

  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: SEO_AI_MODEL,
      max_tokens: 4096, // ↑ 1536 était trop bas : le JSON de recommandations était tronqué → parse KO → « IA indisponible »
      system: SEO_AI_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Faits d'audit SEO du site public :\n${JSON.stringify(reportToAiPayload(report), null, 2)}`,
        },
      ],
    });
    const text = response.content
      .filter((b): b is { type: "text"; text: string } => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    const parsed = parseAiJson(text);
    return { ...fallback, summary: parsed.summary, recommendations: parsed.recommendations };
  } catch (e) {
    console.warn("[seo-analyzer] appel Anthropic échoué :", e);
    return fallback;
  }
}
