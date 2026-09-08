import "server-only";
import { adminDb } from "./firebase-admin";
import { ValidationError } from "./products-service";
import { varietyKey } from "./variety-key";
import type { VarietyEditorial, VarietyEditorialInput } from "./types";

// ─────────────────────────────────────────────────────────────
// Fiches éditoriales des variétés — couche serveur.
//
// Pourquoi cette collection existe : jusqu'ici, la seule façon de régler ce
// qu'on voit d'une variété sur bleuh.co (sa catégorie, donc sa COULEUR, son
// texte, son image) était d'ouvrir la fiche du produit qui l'affiche. Une
// variété qui n'est pas encore en rotation n'apparaît sur aucun produit :
// elle n'était donc réglable NULLE PART, et on ne pouvait la corriger
// qu'après sa mise en circulation, une fois la mauvaise couleur déjà
// publique.
//
// Une fiche éditoriale est attachée à la VARIÉTÉ, pas à un produit. Elle est
// modifiable à tout moment, y compris pour une variété inactive, et sert de
// valeur de départ aux cartes « variétés en rotation » des produits.
//
// La fiche est recopiée dans la carte AU MOMENT où l'on nomme la variété dans
// le formulaire produit, et à ce moment-là seulement. Elle n'est volontairement
// PAS réappliquée à l'enregistrement : côté serveur, « ce champ est vide »
// et « on a vidé ce champ exprès » sont indiscernables, donc un remplissage
// automatique à chaque écriture ferait revenir l'image qu'on vient de retirer
// d'une carte, et rejouerait l'héritage sur un produit en ligne à la moindre
// modification sans rapport (un simple passage en « publié » suffirait). La
// recopie a lieu là où l'humain la voit, la corrige et la valide.
//
// Ce n'est PAS une brèche dans la règle « on ne crée pas de variété » que
// défend varieties-service.ts : on ne crée ici aucune ligne de référentiel et
// le vocabulaire de l'ERP reste seul juge de ce qui existe. Une fiche
// orpheline (variété disparue du référentiel) n'ajoute rien nulle part : elle
// ne fait que dormir jusqu'à ce qu'une carte porte ce nom.
// ─────────────────────────────────────────────────────────────

export const VARIETY_EDITORIALS_COLLECTION = "variety_editorials";

export function editorialsCol() {
  return adminDb().collection(VARIETY_EDITORIALS_COLLECTION);
}

const MAX_LEN = {
  name: 200,
  category: 120,
  thc: 60,
  image: 600,
  url: 600,
  note: 500,
} as const;

function trimmedOrNull(v: unknown, field: string, max: number): string | null {
  if (v == null) return null;
  if (typeof v !== "string") {
    throw new ValidationError(`« ${field} » doit être du texte.`);
  }
  const s = v.trim();
  if (!s) return null;
  if (s.length > max) {
    throw new ValidationError(`« ${field} » est trop long (${max} caractères maximum).`);
  }
  return s;
}

/**
 * N'accepte qu'une adresse http(s) ou un chemin interne.
 *
 * `url` finit en `href` d'une carte publique : un `javascript:` saisi ici
 * serait du script stocké. Le storefront ne suit aujourd'hui que des liens
 * internes reconnus, mais cette garantie tient à son code, pas au nôtre — on
 * ne stocke pas une valeur dont l'innocuité dépend d'un autre dépôt.
 *
 * C'est une LISTE BLANCHE et non un filtre de schémas interdits : les
 * navigateurs ignorent les caractères de contrôle en analysant un `href`, si
 * bien que `java\tscript:…` s'exécute alors qu'il ne ressemble plus à
 * `javascript:`. On dépouille donc la chaîne de ces caractères avant de la
 * confronter aux deux seules formes admises. `//evil.com` est rejeté au
 * passage : c'est une URL protocol-relative, donc un lien externe déguisé en
 * chemin.
 */
function assertSafeUrl(value: string | null, field: string): string | null {
  if (value === null) return null;
  const probe = value.replace(/[\u0000-\u0020]/g, "");
  const isAbsolute = /^https?:\/\//i.test(probe);
  const isInternalPath = /^\/(?!\/)/.test(probe);
  if (!isAbsolute && !isInternalPath) {
    throw new ValidationError(
      `« ${field} » doit être une adresse http(s) ou un chemin commençant par « / ».`
    );
  }
  return value;
}

export function validateEditorialInput(raw: unknown): VarietyEditorialInput {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new ValidationError("Corps de requête invalide.");
  }
  const b = raw as Record<string, unknown>;

  const name = trimmedOrNull(b.name, "name", MAX_LEN.name);
  if (!name) throw new ValidationError("Le nom de la variété est requis.");
  if (!varietyKey(name)) {
    throw new ValidationError("Le nom de la variété doit contenir au moins une lettre ou un chiffre.");
  }

  return {
    name,
    category: trimmedOrNull(b.category, "category", MAX_LEN.category),
    thc: trimmedOrNull(b.thc, "thc", MAX_LEN.thc),
    image: assertSafeUrl(trimmedOrNull(b.image, "image", MAX_LEN.image), "image"),
    url: assertSafeUrl(trimmedOrNull(b.url, "url", MAX_LEN.url), "url"),
    note: trimmedOrNull(b.note, "note", MAX_LEN.note),
  };
}

/** Normalise la liste d'orthographes absorbées reçue du client. */
export function normalizeAliasKeys(raw: unknown, selfKey: string): string[] {
  if (!Array.isArray(raw)) return [];
  const out = new Set<string>();
  for (const item of raw) {
    const k = varietyKey(item);
    if (k && k !== selfKey) out.add(k);
  }
  // Simple garde-fou de taille de document : une fiche qui absorberait des
  // dizaines d'orthographes trahirait un problème de curation, pas un besoin
  // réel. Le rapprochement se fait en mémoire côté formulaire, il n'y a donc
  // pas de limite de requête à respecter ici.
  return [...out].slice(0, 50);
}

export function docToEditorial(doc: FirebaseFirestore.DocumentSnapshot): VarietyEditorial {
  const d = (doc.data() || {}) as Partial<VarietyEditorial>;
  return {
    key: doc.id,
    name: d.name || doc.id,
    category: d.category ?? null,
    thc: d.thc ?? null,
    image: d.image ?? null,
    url: d.url ?? null,
    note: d.note ?? null,
    aliasKeys: Array.isArray(d.aliasKeys) ? d.aliasKeys : [],
    createdAt: d.createdAt || "",
    updatedAt: d.updatedAt || "",
    updatedBy: d.updatedBy ?? null,
  };
}

export async function listEditorials(): Promise<VarietyEditorial[]> {
  const snap = await editorialsCol().get();
  return snap.docs
    .map(docToEditorial)
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

export async function getEditorial(key: string): Promise<VarietyEditorial | null> {
  if (!key) return null;
  const doc = await editorialsCol().doc(key).get();
  return doc.exists ? docToEditorial(doc) : null;
}

export async function saveEditorial(
  key: string,
  input: VarietyEditorialInput,
  aliasKeys: string[],
  actorEmail: string
): Promise<VarietyEditorial> {
  const ref = editorialsCol().doc(key);
  const existing = await ref.get();
  const now = new Date().toISOString();
  const payload = {
    ...input,
    key,
    aliasKeys,
    createdAt: (existing.data()?.createdAt as string) || now,
    updatedAt: now,
    updatedBy: actorEmail,
  };
  // set() total et non merge : les champs de la fiche sont tous fournis par
  // le formulaire, et vider un champ doit bien l'effacer — un merge laisserait
  // l'ancienne valeur en place et la fiche mentirait sur ce qu'elle impose.
  await ref.set(payload);
  return payload;
}

export async function deleteEditorial(key: string): Promise<boolean> {
  const ref = editorialsCol().doc(key);
  const doc = await ref.get();
  if (!doc.exists) return false;
  await ref.delete();
  return true;
}
