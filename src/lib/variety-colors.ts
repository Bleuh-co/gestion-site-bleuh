/**
 * Couleur du libellé de catégorie d'une variété.
 *
 * Le storefront ne stocke aucune couleur : il la DÉDUIT du texte libre de la
 * catégorie (« Hybride à dominance indica » → rose). Changer la couleur d'une
 * variété, c'est donc changer cette phrase — et rien d'autre. Ce module est
 * la copie fidèle, côté administration, de `categoryColor` du storefront
 * (site-bleuh ProductDetailPage.tsx), pour que l'aperçu montre exactement ce
 * que le visiteur verra.
 *
 * L'ordre des tests n'est pas décoratif : « sativa » l'emporte sur
 * « indica », donc « Hybride, Indica, Sativa » vire au jaune. C'est la règle
 * de la fiche produit du storefront, la seule qui gouverne les cartes que cet
 * écran alimente.
 */
export const STRAIN_COLORS = {
  sativa: "#ffd100",
  indica: "#f095cd",
  hybrid: "#ff8300",
} as const;

export type StrainColorKey = keyof typeof STRAIN_COLORS;

/** Nom humain de la couleur — sert à l'écrire en toutes lettres dans l'UI. */
export const STRAIN_COLOR_LABELS: Record<StrainColorKey, string> = {
  sativa: "jaune",
  indica: "rose",
  hybrid: "orange",
};

export function categoryStrain(category?: string | null): StrainColorKey {
  const c = (category ?? "").toLowerCase();
  if (c.includes("sativa")) return "sativa";
  if (c.includes("indica")) return "indica";
  return "hybrid";
}

export function categoryColor(category?: string | null): string {
  return STRAIN_COLORS[categoryStrain(category)];
}

/** « rose », « orange »… pour la phrase d'aperçu sous le champ Catégorie. */
export function categoryColorLabel(category?: string | null): string {
  return STRAIN_COLOR_LABELS[categoryStrain(category)];
}
