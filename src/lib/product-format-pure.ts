// ─────────────────────────────────────────────────────────────
// Format d'un produit (`formatSlug`) — helpers PURS (aucune I/O),
// partagés par le formulaire (client) et validateProductInput (serveur).
//
// Ticket zNkmlB547pBJBsJKaXkV (M. Poulin) : « Format » était un champ de
// texte libre. La cartouche Bleuh Original Indica Blossom Kush y avait été
// saisie « Vape », avec une majuscule. Le filtre « Types » de bleuh.co
// compare le slug À L'IDENTIQUE : elle manquait sous « Cartouches ».
//
// PRODUCT_FORMATS est la liste `formatsList` du site (site-bleuh,
// src/components/products/ProductsPage.tsx) : un produit dont le format n'y
// figure pas n'apparaît dans aucun filtre. Ajouter un format = l'ajouter
// aux DEUX endroits. Table d'écritures jumelle de celle de
// site-bleuh/src/lib/product-format-pure.ts, qui relit les fiches déjà
// en base avec les mêmes règles.
// ─────────────────────────────────────────────────────────────

/** Formats du filtre « Types » de bleuh.co, dans l'ordre et avec les libellés du site. */
export const PRODUCT_FORMATS = [
  { slug: "fleurs-sechees", label: "Fleurs séchées" },
  { slug: "haschich", label: "Haschich" },
  { slug: "moulu", label: "Prémoulus" },
  { slug: "preroules", label: "Préroulés" },
  { slug: "vape", label: "Cartouches" },
] as const;

export type ProductFormatSlug = (typeof PRODUCT_FORMATS)[number]["slug"];

/**
 * Écritures rencontrées → slug du site. Les clés sont comparées après
 * `key()` : minuscules, sans accents, espaces et tirets réduits à un tiret.
 */
const ALIASES: Record<string, ProductFormatSlug> = {
  // Slugs d'URL de l'ancien site WordPress.
  vapoteuses: "vape",
  fleurssches: "fleurs-sechees",
  prmoulus: "moulu",
  prrouls: "preroules",
  // Libellés et catégories, français et anglais (dont la colonne Category
  // du Products Master : « Cartridge », « Dried Flowers »…).
  vapes: "vape",
  vapoteuse: "vape",
  cartouche: "vape",
  cartouches: "vape",
  cartridge: "vape",
  cartridges: "vape",
  "fleur-sechee": "fleurs-sechees",
  "dried-flower": "fleurs-sechees",
  "dried-flowers": "fleurs-sechees",
  hash: "haschich",
  hasch: "haschich",
  premoulu: "moulu",
  premoulus: "moulu",
  milled: "moulu",
  preroule: "preroules",
  "pre-roll": "preroules",
  "pre-rolls": "preroules",
  prerolls: "preroules",
};

function key(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[\s_-]+/g, "-");
}

export function isKnownFormatSlug(slug: string): slug is ProductFormatSlug {
  return PRODUCT_FORMATS.some((f) => f.slug === slug);
}

/**
 * Ramène une écriture du format au slug du site : « Vape », « Cartouches »,
 * « cartridge » → « vape ». Vide ou absent → "". Une valeur inconnue revient
 * telle quelle (rognée) : c'est à l'appelant de la refuser ou de la montrer,
 * jamais de la ranger d'office dans un format.
 */
export function normalizeFormatSlug(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const k = key(trimmed);
  if (isKnownFormatSlug(k)) return k;
  return ALIASES[k] ?? trimmed;
}
