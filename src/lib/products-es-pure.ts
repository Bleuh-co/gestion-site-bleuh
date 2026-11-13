/**
 * La section ESPAGNOLE d'une fiche produit (2026-11-13, demande de Thierry
 * Matteucci : « une troisième section espagnole, pour l'instant traduite
 * automatiquement à partir du contenu existant »).
 *
 * Elle ne vit PAS dans le document du produit (`products/{id}`), mais dans une
 * collection à part, `products_es/{id}`. Raison : `products` est écrite par
 * deux consoles sans verrou — Marketing Bleuh et l'onglet « Gestion Produits
 * Site » de Gestion Produit Bleuh — dont les validations sont des LISTES
 * BLANCHES : un champ qu'elles ne connaissent pas est jeté à l'enregistrement.
 * Un espagnol rangé dans la fiche disparaîtrait à la première retouche faite
 * depuis l'autre console. Rangé à part, rien ne peut l'effacer par mégarde.
 *
 * bleuh.co lit `products_es` en même temps que `products` et pose l'espagnol
 * sur la fiche ; un champ vide ici s'affiche en anglais sur /es.
 *
 * Module PUR (aucune importation) : testé par `products-es-pure.test.ts`.
 */

export const PRODUCTS_ES_COLLECTION = "products_es";

/** Les champs de détail d'une fiche, dans l'ordre de l'écran. */
export const DETAILS_ES = ["format", "variety", "effects", "terpenes", "growLocation", "distribution"] as const;
export type DetailEs = (typeof DETAILS_ES)[number];

/** Les textes d'une fiche qui ont une version espagnole. Tout est facultatif : vide = l'anglais. */
export interface ProductEsTextes {
  name: string;
  description: string;
  seoTitle: string;
  metaDescription: string;
  currentRotation: string;
  details: Record<DetailEs, string>;
}

export interface ProductEs extends ProductEsTextes {
  /** = l'identifiant du produit (slug français). */
  id: string;
  /**
   * Le texte ANGLAIS d'où vient cette traduction, champ par champ. Sert à dire
   * « l'anglais a changé depuis » : sans lui, une traduction périmée resterait
   * en ligne sans que personne ne le voie.
   */
  source: ProductEsTextes;
  /** « auto » tant que personne n'a retouché la traduction à la main. */
  mode: "auto" | "manuel";
  updatedAt: string;
  updatedBy: string | null;
}

/** La moitié d'une fiche dont on a besoin ici (forme de `Product`, indulgente). */
export interface FicheSource {
  name?: { fr?: string | null; en?: string | null } | null;
  description?: { fr?: string | null; en?: string | null } | null;
  seoTitle?: { fr?: string | null; en?: string | null } | null;
  metaDescription?: { fr?: string | null; en?: string | null } | null;
  currentRotation?: { fr?: string | null; en?: string | null } | null;
  details?: Partial<Record<DetailEs, { fr?: string | null; en?: string | null } | null>> | null;
}

export const MAX_ES = { name: 200, description: 6000, seoTitle: 200, metaDescription: 500, currentRotation: 300, detail: 600 } as const;

const texte = (v: unknown): string => (typeof v === "string" ? v : "");

export function textesVides(): ProductEsTextes {
  return {
    name: "",
    description: "",
    seoTitle: "",
    metaDescription: "",
    currentRotation: "",
    details: { format: "", variety: "", effects: "", terpenes: "", growLocation: "", distribution: "" },
  };
}

/** Les textes d'une fiche dans une langue, à plat — la matière à traduire. */
export function textesDeLaFiche(fiche: FicheSource, langue: "fr" | "en"): ProductEsTextes {
  const out = textesVides();
  out.name = texte(fiche.name?.[langue]).trim();
  out.description = texte(fiche.description?.[langue]);
  out.seoTitle = texte(fiche.seoTitle?.[langue]).trim();
  out.metaDescription = texte(fiche.metaDescription?.[langue]).trim();
  out.currentRotation = texte(fiche.currentRotation?.[langue]).trim();
  for (const d of DETAILS_ES) out.details[d] = texte(fiche.details?.[d]?.[langue]).trim();
  return out;
}

/** Tous les champs, à plat : `name`, `details.format`… — pour comparer et lister. */
export function champsAPlat(t: ProductEsTextes): Record<string, string> {
  const out: Record<string, string> = {
    name: t.name,
    description: t.description,
    seoTitle: t.seoTitle,
    metaDescription: t.metaDescription,
    currentRotation: t.currentRotation,
  };
  for (const d of DETAILS_ES) out[`details.${d}`] = t.details[d];
  return out;
}

/**
 * Les champs dont l'anglais a changé depuis la traduction (ou qui n'ont jamais
 * été traduits alors que l'anglais existe). Vide = la section est à jour.
 */
export function champsPerimes(es: ProductEsTextes & { source?: ProductEsTextes } | null, anglais: ProductEsTextes): string[] {
  const actuel = champsAPlat(anglais);
  if (!es) return Object.keys(actuel).filter((k) => actuel[k].trim());
  const traduit = champsAPlat(es);
  const source = es.source ? champsAPlat(es.source) : {};
  return Object.keys(actuel).filter((k) => {
    const en = actuel[k].trim();
    if (!en) return false;
    if (!traduit[k].trim()) return true;
    return (source[k] ?? "").trim() !== en;
  });
}

export type Validated<T> = { ok: true; value: T } | { ok: false; error: string };

/** Ce que l'écran envoie → ce qu'on enregistre. LISTE BLANCHE : rien d'autre ne passe. */
export function validerTextesEs(raw: unknown): Validated<ProductEsTextes> {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Section espagnole manquante ou invalide." };
  const o = raw as Record<string, unknown>;
  const out = textesVides();
  const lire = (v: unknown, nom: string, max: number): string | null => {
    if (v == null) return "";
    if (typeof v !== "string") return null;
    return v.length > max ? null : v;
  };
  const champs: [keyof Omit<ProductEsTextes, "details">, string, number][] = [
    ["name", "Nom", MAX_ES.name],
    ["description", "Description", MAX_ES.description],
    ["seoTitle", "Titre Google", MAX_ES.seoTitle],
    ["metaDescription", "Description Google", MAX_ES.metaDescription],
    ["currentRotation", "Rotation actuelle", MAX_ES.currentRotation],
  ];
  for (const [cle, nom, max] of champs) {
    const v = lire(o[cle], nom, max);
    if (v === null) return { ok: false, error: `« ${nom} » (espagnol) : texte attendu, ${max} caractères au plus.` };
    out[cle] = cle === "description" ? v : v.trim();
  }
  const details = o.details && typeof o.details === "object" ? (o.details as Record<string, unknown>) : {};
  for (const d of DETAILS_ES) {
    const v = lire(details[d], d, MAX_ES.detail);
    if (v === null) return { ok: false, error: `Détail « ${d} » (espagnol) : texte attendu, ${MAX_ES.detail} caractères au plus.` };
    out.details[d] = v.trim();
  }
  return { ok: true, value: out };
}

/** Un document de `products_es` relu avec indulgence : un champ illisible = vide. */
export function lireProductEs(id: string, data: Record<string, unknown> | null | undefined): ProductEs | null {
  if (!data) return null;
  const v = validerTextesEs(data);
  const s = validerTextesEs(data.source);
  return {
    id,
    ...(v.ok ? v.value : textesVides()),
    source: s.ok ? s.value : textesVides(),
    mode: data.mode === "manuel" ? "manuel" : "auto",
    updatedAt: texte(data.updatedAt),
    updatedBy: typeof data.updatedBy === "string" ? data.updatedBy : null,
  };
}

/**
 * La réponse du modèle → des textes. Le modèle rend un objet JSON aux clés à
 * plat (`name`, `details.format`…) ; tout ce qui n'est pas une chaîne sous une
 * clé attendue est ignoré, et un champ dont l'anglais était vide reste vide.
 */
export function textesDepuisReponse(reponse: string, anglais: ProductEsTextes): Validated<ProductEsTextes> {
  const debut = reponse.indexOf("{");
  const fin = reponse.lastIndexOf("}");
  if (debut < 0 || fin <= debut) return { ok: false, error: "La traduction reçue est illisible." };
  let brut: unknown;
  try {
    brut = JSON.parse(reponse.slice(debut, fin + 1));
  } catch {
    return { ok: false, error: "La traduction reçue est illisible." };
  }
  if (!brut || typeof brut !== "object") return { ok: false, error: "La traduction reçue est illisible." };
  const recu = brut as Record<string, unknown>;
  const source = champsAPlat(anglais);
  const out = textesVides();
  for (const cle of Object.keys(source)) {
    const v = source[cle].trim() && typeof recu[cle] === "string" ? (recu[cle] as string) : "";
    if (cle.startsWith("details.")) out.details[cle.slice(8) as DetailEs] = v.trim();
    else if (cle === "description") out.description = v;
    else (out as unknown as Record<string, string>)[cle] = v.trim();
  }
  return validerTextesEs(out);
}
