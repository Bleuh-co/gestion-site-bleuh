/**
 * LES PAGES DE BLEUH.CO TELLES QUE « TITRES ET DESCRIPTIONS » LES MONTRE —
 * lues dans le plan du site, regroupées par page (français et anglais côte à
 * côte), rangées par section ; et la lecture de l'en-tête d'une page en ligne.
 *
 * POURQUOI LE PLAN DU SITE. C'est la liste exacte des adresses que bleuh.co
 * soumet à Google, chacune dans la langue où un robot la voit (/fr = version
 * Québec, /en = version Canada). Une page ajoutée au site apparaît donc ici
 * toute seule, sans qu'on tienne une liste à la main (Marketing Chanv en
 * avait une : elle a pris dix pages de retard en un mois).
 *
 * Les fiches produits en sont écartées : leur référencement se règle sur la
 * fiche, dans Produits.
 *
 * Module pur (aucune lecture réseau ni Firestore) : testé par
 * `test/seo-pages.test.ts`.
 */
import { cheminDeAdresse, langueDuChemin, type Langue } from "./seo-reglages-pure";

/** Une `<url>` du plan du site : son adresse, et ses équivalents annoncés (hreflang). */
export interface EntreePlan {
  chemin: string;
  fr: string | null;
  en: string | null;
}

export type SectionSeo =
  | "principales"
  | "histoire"
  | "collections"
  | "explorer"
  | "reperes"
  | "varietes"
  | "legales"
  | "autres";

/** L'ordre d'affichage des sections. */
export const SECTIONS_SEO: readonly SectionSeo[] = [
  "principales",
  "histoire",
  "collections",
  "explorer",
  "reperes",
  "varietes",
  "legales",
  "autres",
];

/** Une page de bleuh.co : une ou deux adresses (fr, en), toutes au plan du site. */
export interface PageSeo {
  /** L'adresse française, ou l'anglaise pour une page anglaise seulement. */
  id: string;
  nom: { fr: string; en: string };
  section: SectionSeo;
  adresses: Partial<Record<Langue, string>>;
}

/** Ce que l'en-tête d'une page en ligne dit à Google. */
export interface TeteDePage {
  title: string;
  description: string;
  ogImage: string;
  canonical: string;
  robots: string;
}

const ENTITES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

/** `&amp;`, `&#x27;`, `&#39;`… → caractères. */
export function decoderEntites(v: string): string {
  return v.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (tout, code: string) => {
    if (code[0] === "#") {
      const n = code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : tout;
    }
    return ENTITES[code.toLowerCase()] ?? tout;
  });
}

/** Le plan du site (XML) → ses entrées, adresses ramenées à leur chemin. */
export function lirePlanDuSite(xml: string): EntreePlan[] {
  const out: EntreePlan[] = [];
  for (const m of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const bloc = m[1];
    const loc = /<loc>\s*([^<\s]+)\s*<\/loc>/.exec(bloc)?.[1];
    const chemin = loc ? cheminDeAdresse(decoderEntites(loc)) : null;
    if (!chemin) continue;
    const alt = (h: string) => {
      const r = new RegExp(`hreflang="${h}"\\s+href="([^"]+)"`, "i").exec(bloc);
      return r ? cheminDeAdresse(decoderEntites(r[1])) : null;
    };
    out.push({ chemin, fr: alt("fr-CA"), en: alt("en-CA") });
  }
  return out;
}

/** Une fiche produit : son référencement se règle dans Produits, pas ici. */
export function estFicheProduit(chemin: string): boolean {
  return /^\/fr\/produit\/|^\/en\/product\//.test(chemin);
}

/** Le premier segment anglais → son équivalent français, pour ranger une page anglaise seule. */
const SEGMENT_EN_FR: Record<string, string> = {
  map: "carte",
  products: "produits",
  strains: "varietes",
  "our-story": "notre-histoire",
  "weekly-rotations": "lots-disponibles",
  "privacy-policy": "politique-de-confidentialite",
  "terms-of-service": "conditions-dutilisation",
  "your-bearings": "vos-reperes",
  "your-moments": "vos-moments",
  "your-needs": "vos-besoins",
};

/** Les noms des pages connues, par chemin français sans la langue. */
const NOMS: Record<string, { fr: string; en: string }> = {
  "": { fr: "Accueil", en: "Home" },
  carte: { fr: "Où trouver Bleuh", en: "Where to find Bleuh" },
  produits: { fr: "Produits", en: "Products" },
  "produits/nouveautes": { fr: "Nouveautés", en: "New products" },
  "new-products": { fr: "Nouveaux produits (Ontario)", en: "New products (Ontario)" },
  "lots-disponibles": { fr: "Lots disponibles", en: "Weekly rotations" },
  merch: { fr: "Merch", en: "Merch" },
  contact: { fr: "Contact", en: "Contact" },
  "notre-histoire": { fr: "Notre histoire", en: "Our story" },
  "notre-histoire/notre-approche": { fr: "Notre approche", en: "Our approach" },
  "notre-histoire/nos-procedes": { fr: "Nos procédés", en: "Our processes" },
  "notre-histoire/nos-procedes/haschich": { fr: "Nos procédés › Haschich", en: "Our processes › Hash" },
  "notre-histoire/nos-procedes/preroules": { fr: "Nos procédés › Préroulés", en: "Our processes › Pre-rolls" },
  "notre-histoire/nos-procedes/resine-vivante": { fr: "Nos procédés › Résine vivante", en: "Our processes › Live resin" },
  "procedes/cartouches": { fr: "Cartouches", en: "Cartridges" },
  collections: { fr: "Collections", en: "Collections" },
  "produits/formats/cartouches": { fr: "Format › Cartouches", en: "Format › Cartridges" },
  "produits/formats/fleurs": { fr: "Format › Fleurs séchées", en: "Format › Dried flower" },
  "produits/formats/haschich": { fr: "Format › Haschich", en: "Format › Hash" },
  "produits/formats/premoulus": { fr: "Format › Prémoulus", en: "Format › Pre-ground" },
  "produits/formats/preroules": { fr: "Format › Préroulés", en: "Format › Pre-rolls" },
  "produits/categories/hybride": { fr: "Catégorie › Hybride", en: "Category › Hybrid" },
  "produits/categories/indica": { fr: "Catégorie › Indica", en: "Category › Indica" },
  "produits/categories/sativa": { fr: "Catégorie › Sativa", en: "Category › Sativa" },
  "vos-reperes": { fr: "Vos repères", en: "Your bearings" },
  "vos-reperes/aromes-et-terpenes": { fr: "Vos repères › Arômes et terpènes", en: "Your bearings › Aromas and terpenes" },
  "vos-reperes/les-formats": { fr: "Vos repères › Les formats", en: "Your bearings › Formats" },
  "vos-reperes/lire-une-etiquette": { fr: "Vos repères › Lire une étiquette", en: "Your bearings › Reading a label" },
  "vos-reperes/precautions-et-conservation": {
    fr: "Vos repères › Précautions et conservation",
    en: "Your bearings › Precautions and storage",
  },
  "vos-reperes/thc-et-cbd": { fr: "Vos repères › THC et CBD", en: "Your bearings › THC and CBD" },
  "vos-moments": { fr: "Vos moments", en: "Your moments" },
  "vos-moments/du-temps-a-soi": { fr: "Vos moments › Du temps à soi", en: "Your moments › Time on your own" },
  "vos-moments/un-petit-rassemblement": { fr: "Vos moments › Un petit rassemblement", en: "Your moments › A small gathering" },
  "vos-moments/un-samedi-apres-midi": { fr: "Vos moments › Un samedi après-midi", en: "Your moments › A weekend afternoon" },
  "vos-moments/un-souper-entre-amis": { fr: "Vos moments › Un souper entre amis", en: "Your moments › Dinner with friends" },
  "vos-moments/une-occasion-speciale": { fr: "Vos moments › Une occasion spéciale", en: "Your moments › A special occasion" },
  "vos-moments/une-soiree-a-la-maison": { fr: "Vos moments › Une soirée à la maison", en: "Your moments › An evening at home" },
  "vos-besoins": { fr: "Vos besoins", en: "Your needs" },
  "vos-besoins/aidez-moi-a-choisir": { fr: "Vos besoins › Aidez-moi à choisir", en: "Your needs › Help me choose" },
  "vos-besoins/comparer-les-profils": { fr: "Vos besoins › Comparer les profils", en: "Your needs › Compare profiles" },
  "vos-besoins/thc-et-cbd": { fr: "Vos besoins › THC et CBD", en: "Your needs › THC and CBD" },
  varietes: { fr: "Variétés", en: "Strains" },
  "varietes/aromes": { fr: "Variétés par arômes", en: "Strains by aroma" },
  "varietes/terpenes": { fr: "Variétés par terpènes", en: "Strains by terpene" },
  "politique-de-confidentialite": { fr: "Politique de confidentialité", en: "Privacy policy" },
  "conditions-dutilisation": { fr: "Conditions d’utilisation", en: "Terms of service" },
  "bleuh-original-quebec": { fr: "Bleuh Original Québec (page d’atterrissage)", en: "Bleuh Original Québec (landing page)" },
  "bleuh-original-wildberry": { fr: "Bleuh Original Wildberry (page d’atterrissage)", en: "Bleuh Original Wildberry (landing page)" },
};

/** Les pages d'une section précise, par premier segment français. */
const SECTION_DU_SEGMENT: Record<string, SectionSeo> = {
  "": "principales",
  carte: "principales",
  produits: "principales",
  "lots-disponibles": "principales",
  merch: "principales",
  contact: "principales",
  "new-products": "principales",
  "bleuh-original-quebec": "principales",
  "bleuh-original-wildberry": "principales",
  "notre-histoire": "histoire",
  procedes: "histoire",
  collections: "collections",
  "vos-reperes": "reperes",
  "vos-moments": "reperes",
  "vos-besoins": "reperes",
  varietes: "varietes",
  "politique-de-confidentialite": "legales",
  "conditions-dutilisation": "legales",
};

/** Le chemin sans la langue, premier segment ramené au français : `/en/strains/x` → `varietes/x`. */
function cheminSansLangue(chemin: string): string {
  const segments = chemin.split("/").slice(2);
  if (langueDuChemin(chemin) === "en" && segments.length) segments[0] = SEGMENT_EN_FR[segments[0]] ?? segments[0];
  return segments.join("/");
}

function sectionDe(sansLangue: string): SectionSeo {
  if (/^produits\/(formats|categories|varietes-et-profils)(\/|$)/.test(sansLangue)) return "explorer";
  return SECTION_DU_SEGMENT[sansLangue.split("/")[0]] ?? "autres";
}

/** `blue-dream` → `Blue Dream` ; `thc-et-cbd` → `Thc et cbd`. */
function humaniser(slug: string, majuscules: boolean): string {
  const mots = slug.split("-").filter(Boolean);
  if (!mots.length) return slug;
  return mots
    .map((m, i) => (majuscules || i === 0 ? m.charAt(0).toUpperCase() + m.slice(1) : m))
    .join(" ");
}

function nomDe(sansLangue: string, section: SectionSeo): { fr: string; en: string } {
  const connu = NOMS[sansLangue];
  if (connu) return connu;
  const segments = sansLangue.split("/");
  const dernier = segments[segments.length - 1];
  const parent = NOMS[segments.slice(0, -1).join("/")];
  const propre = humaniser(dernier, section === "varietes" || section === "collections");
  if (!parent || section === "varietes" || section === "collections") return { fr: propre, en: propre };
  return { fr: `${parent.fr} › ${propre}`, en: `${parent.en} › ${propre}` };
}

/**
 * Les entrées du plan du site → les pages, français et anglais réunis quand
 * le plan annonce les deux, triées par section puis par nom. Une adresse
 * annoncée en hreflang mais absente du plan (une page du Québec seulement,
 * dont l'anglais redirige) n'est pas montrée : Google ne la lit pas.
 */
export function pagesDuPlan(entrees: EntreePlan[]): PageSeo[] {
  const dansLePlan = new Set(entrees.map((e) => e.chemin));
  const pages = new Map<string, PageSeo>();
  for (const e of entrees) {
    if (estFicheProduit(e.chemin)) continue;
    const langue = langueDuChemin(e.chemin);
    const fr = langue === "fr" ? e.chemin : e.fr && dansLePlan.has(e.fr) ? e.fr : null;
    const en = langue === "en" ? e.chemin : e.en && dansLePlan.has(e.en) ? e.en : null;
    const id = fr ?? (en as string);
    const page = pages.get(id) ?? { id, nom: { fr: "", en: "" }, section: "autres" as SectionSeo, adresses: {} };
    if (fr) page.adresses.fr = fr;
    if (en) page.adresses.en = en;
    pages.set(id, page);
  }
  const ordre = new Map(SECTIONS_SEO.map((s, i) => [s, i]));
  const liste = [...pages.values()].map((p) => {
    const sansLangue = cheminSansLangue(p.id);
    const section = sectionDe(sansLangue);
    return { ...p, section, nom: nomDe(sansLangue, section) };
  });
  return liste.sort(
    (a, b) =>
      (ordre.get(a.section) ?? 99) - (ordre.get(b.section) ?? 99) ||
      (a.id.split("/").length - b.id.split("/").length) ||
      a.nom.fr.localeCompare(b.nom.fr, "fr"),
  );
}

/** Les attributs d'une balise, noms en minuscules, valeurs décodées. */
function attributs(balise: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of balise.matchAll(/([a-zA-Z:-]+)\s*=\s*"([^"]*)"/g)) out[m[1].toLowerCase()] = decoderEntites(m[2]);
  return out;
}

/**
 * L'en-tête d'une page de bleuh.co (son HTML) → ce qu'elle dit à Google. Seul
 * le `<head>` est lu : une icône SVG du corps porte aussi des `<title>`.
 */
export function lireTete(html: string): TeteDePage {
  const fin = html.search(/<\/head>/i);
  const head = fin >= 0 ? html.slice(0, fin) : html;
  const tete: TeteDePage = { title: "", description: "", ogImage: "", canonical: "", robots: "" };
  const titre = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(head);
  if (titre) tete.title = decoderEntites(titre[1]).replace(/\s+/g, " ").trim();
  for (const m of head.matchAll(/<meta\b[^>]*>/gi)) {
    const a = attributs(m[0]);
    const nom = (a.name ?? a.property ?? "").toLowerCase();
    const contenu = (a.content ?? "").trim();
    if (nom === "description" && !tete.description) tete.description = contenu;
    else if (nom === "og:image" && !tete.ogImage) tete.ogImage = contenu;
    else if (nom === "robots" && !tete.robots) tete.robots = contenu;
  }
  for (const m of head.matchAll(/<link\b[^>]*>/gi)) {
    const a = attributs(m[0]);
    if ((a.rel ?? "").toLowerCase() === "canonical" && !tete.canonical) tete.canonical = a.href ?? "";
  }
  return tete;
}
