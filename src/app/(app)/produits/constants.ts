// Constantes UI du module Produits, portees depuis
// Formulaire DB-Products-Master/public/site-products.js.
// Contrairement a `status`/`strain`/`provinces`, `collection` n'est PAS un
// enum strict cote serveur (validateProductInput accepte toute string non
// vide) : cette liste ne contraint que le select cote client, l'API accepte
// aussi une valeur libre.
import type { ProductProvince, ProductStatus, ProductStrain } from "@/lib/types";

export const KNOWN_COLLECTIONS = [
  "bleuh",
  "bleuh-light",
  "blakh",
  "blanh",
  "goldh",
  "grindh",
  "skyh",
] as const;

export const STATUS_LABELS: Record<ProductStatus, string> = {
  draft: "Brouillon",
  published: "Publié",
  archived: "Archivé",
};

export const STRAIN_LABELS: Record<ProductStrain, string> = {
  indica: "Indica",
  sativa: "Sativa",
  hybrid: "Hybride",
};

export const PROVINCE_LABELS: Record<ProductProvince, string> = {
  qc: "Québec",
  on: "Ontario",
};

/**
 * Suggestions pour la catégorie d'une variété en rotation.
 *
 * Ce champ est du TEXTE LIBRE affiché tel quel sur la fiche produit publique :
 * ce n'est pas STRAIN_LABELS (l'enum du produit lui-même). Les cinq premières
 * valeurs sont celles déjà présentes dans le catalogue importé, les suivantes
 * les formulations demandées ensuite. Le site ne s'en sert que pour la
 * couleur du libellé (il cherche « indica » ou « sativa » dans la phrase,
 * sinon hybride), donc toute autre formulation reste valide.
 */
export const ROTATION_CATEGORY_SUGGESTIONS = [
  "Indica",
  "Sativa",
  "Hybride",
  "Hybride, Indica",
  "Hybride, Sativa",
  "Hybride à dominance indica",
  "Hybride à dominance sativa",
] as const;

export function statusBadgeClass(status: ProductStatus): string {
  switch (status) {
    case "published":
      return "bg-emerald-50 text-emerald-700 border border-emerald-200";
    case "archived":
      return "bg-slate-100 text-slate-600 border border-slate-200";
    case "draft":
    default:
      return "bg-amber-50 text-amber-700 border border-amber-200";
  }
}
