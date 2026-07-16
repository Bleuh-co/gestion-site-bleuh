// ─────────────────────────────────────────────────────────────
// Types du module « Analyse SEO » — référencement du site public SiteBleuh.
//
// Distinct de l'Analyse CEO (business/KPIs bot). Ici on audite le HTML rendu
// serveur (SSR) que voit Google : balises meta, canonical, hreflang, JSON-LD,
// Open Graph, robots.txt / sitemap.xml, etc. Purement descriptif : aucun de ces
// types ne transporte d'allégation, uniquement des faits mesurés sur le HTML.
// ─────────────────────────────────────────────────────────────

export type SeoSeverity = "critique" | "moyenne" | "info";

/** Un problème SEO agrégé au niveau site, classé par sévérité. */
export interface SeoIssue {
  id: string;
  severity: SeoSeverity;
  title: string;
  detail: string;
  /** Nombre de pages concernées (0 si problème global : robots/sitemap absent). */
  pagesAffected: number;
  /** Échantillon d'URLs concernées (borné) pour aider au diagnostic. */
  sampleUrls?: string[];
}

/** Résultat d'analyse d'une page individuelle. */
export interface SeoPageResult {
  url: string;
  /** Statut HTTP obtenu (0 si la requête a échoué avant réponse). */
  status: number;
  /** Erreur réseau/parse si la page n'a pas pu être analysée (jamais throw). */
  error: string | null;
  /** Temps de réponse en ms. */
  responseMs: number;

  title: { present: boolean; text: string; length: number };
  metaDescription: { present: boolean; text: string; length: number };
  h1Count: number;
  canonical: { present: boolean; value: string | null };
  /** Alternates hreflang détectés (langue → href). */
  hreflang: { present: boolean; langs: string[] };
  /** meta robots (ex. "noindex,nofollow"). */
  metaRobots: { present: boolean; value: string | null; noindex: boolean };
  images: { total: number; missingAlt: number };
  /** @type collectés dans les blocs <script type="application/ld+json">. */
  jsonLd: { blocks: number; types: string[] };
  openGraph: { title: boolean; description: boolean; image: boolean };
  twitterCard: boolean;
  wordCount: number;
  /** true si wordCount < 150 (contenu potentiellement mince). */
  thinContent: boolean;
}

/** Volet technique (niveau site, hors page-par-page). */
export interface SeoTechnical {
  baseUrl: string;
  https: boolean;
  robotsTxt: { present: boolean; status: number; hasSitemapRef: boolean };
  sitemapXml: { present: boolean; status: number; urlCount: number };
  home: { status: number; responseMs: number; htmlBytes: number };
}

/** Rapport complet stocké dans Firestore (seo_reports/latest). */
export interface SeoReport {
  generatedAt: string; // ISO
  baseUrl: string;
  /** Score global pondéré /100. */
  score: number;
  technical: SeoTechnical;
  pagesScanned: number;
  pages: SeoPageResult[];
  issues: SeoIssue[];
  summary: {
    pagesMissingTitle: number;
    pagesMissingMetaDescription: number;
    duplicateTitles: number;
    duplicateMetaDescriptions: number;
    pagesMissingCanonical: number;
    pagesMissingHreflang: number;
    pagesMissingJsonLd: number;
    pagesWithNoindex: number;
    pagesThinContent: number;
    pagesWithError: number;
  };
}

/** Sortie de la synthèse IA (POST /api/seo/analyse). */
export interface SeoRecommendation {
  priorite: "haute" | "moyenne" | "basse";
  action: string;
  pourquoi: string;
}

export interface SeoAnalyseResult {
  generatedAt: string;
  model: string;
  basedOnReportAt: string | null;
  summary: string | null;
  recommendations: SeoRecommendation[];
}
