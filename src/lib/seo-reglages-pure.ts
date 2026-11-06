/**
 * LES TITRES ET DESCRIPTIONS DE BLEUH.CO RÉGLÉS DANS MARKETING BLEUH — la clé
 * d'une page, la lecture d'un réglage et la validation d'écriture.
 *
 * Demande de Daphnée Paquette (06/11/2026) : « Comment notre site gère les
 * méta-descriptions et les titles ? » Jusque-là, tout était écrit dans le
 * code ; Google affichait encore des textes du clone de juillet. Marketing
 * Bleuh › Titres et descriptions les règle maintenant page par page, comme
 * Marketing MDH le fait pour maisondherbes.com.
 *
 * ⚠ MODULE PARTAGÉ : `site-bleuh/src/lib/seo-reglages-pure.ts` et
 * `gestion-site-bleuh/src/lib/seo-reglages-pure.ts` sont des COPIES
 * CONFORMES. Ce fichier n'importe RIEN. Un changement d'un côté se recopie de
 * l'autre, et l'empreinte `EMPREINTE_MODULE` des deux tests se met à jour :
 * le test refuse un module modifié d'un seul côté.
 *
 * QUI ÉCRIT, QUI LIT. Un document par ADRESSE de bleuh.co dans
 * `bleuh_site_seo` (base du hub, antigravity-20260107). Marketing Bleuh est
 * le SEUL à écrire ; le site ne fait que lire. La préprod lit la même base.
 *
 * LA CLÉ EST L'ADRESSE CANONIQUE de la page, langue comprise :
 * `/fr/notre-histoire` → `fr__notre-histoire`, `/en` → `en`. Google lit
 * /fr (version Québec) et /en (version Canada) comme deux pages : chacune a
 * son titre et sa description. Vérifié le 06/11/2026 sur les 306 adresses du
 * plan du site hors fiches produits : l'adresse canonique de chaque page est
 * exactement son adresse dans le plan du site.
 *
 * UN CHAMP VIDE GARDE LE TEXTE DU SITE. Rien n'est inventé : sans réglage,
 * la page garde le titre et la description écrits dans son code.
 *
 * Les fiches produits n'en font pas partie : leur référencement se règle dans
 * Marketing Bleuh › Produits (`seoTitle`, `metaDescription`…).
 */

/** La collection Firestore — écrite par Marketing Bleuh, lue par bleuh.co. */
export const COLLECTION_SEO = 'bleuh_site_seo';

/** Repères de Google (tronque souvent au-delà) : avertissent, ne bloquent pas. */
export const REPERE_TITRE = 60;
export const REPERE_DESCRIPTION = 155;

/** Plafonds d'écriture : au-delà, ce n'est plus un titre ni une description. */
export const MAX_TITRE = 200;
export const MAX_DESCRIPTION = 500;
export const MAX_IMAGE = 1000;

export type Langue = 'fr' | 'en';

/** Ce qu'une adresse a de réglé. Une chaîne vide = le texte du site. */
export interface ReglageSeo {
  /** `fr__notre-histoire` — l'identifiant du document. */
  cle: string;
  /** `/fr/notre-histoire` — l'adresse, sans domaine ni barre finale. */
  chemin: string;
  title: string;
  description: string;
  /** Image de partage (Facebook, LinkedIn, Messenger), adresse https. */
  ogImage: string;
}

/** Les champs qu'on peut écrire, et rien d'autre. */
export interface ReglageEcrit {
  title: string;
  description: string;
  ogImage: string;
}

/** Résultat d'une validation : la valeur propre, ou le message pour l'écran. */
export type Validated<T> = { ok: true; value: T } | { ok: false; error: string };

const MOTIF_CHEMIN = /^\/(fr|en)(\/[a-z0-9-]+)*$/;

/**
 * L'adresse d'une page de bleuh.co ramenée à son chemin : `https://bleuh.co/fr/x/`,
 * `/fr/x` ou `fr/x` → `/fr/x`. Seules les adresses en /fr ou /en, faites de
 * segments `[a-z0-9-]`, sont acceptées ; tout le reste rend `null`.
 */
export function cheminDeAdresse(adresse: string | null | undefined): string | null {
  if (typeof adresse !== 'string') return null;
  let brut = adresse.trim();
  if (!brut) return null;
  const protocole = /^https?:\/\/[^/]+/i.exec(brut);
  if (protocole) brut = brut.slice(protocole[0].length);
  brut = brut.split(/[?#]/)[0];
  if (!brut.startsWith('/')) brut = `/${brut}`;
  brut = brut.replace(/\/+$/, '');
  return MOTIF_CHEMIN.test(brut) ? brut : null;
}

/** `/fr/notre-histoire/nos-procedes` → `fr__notre-histoire__nos-procedes`. */
export function cleDeChemin(chemin: string): string {
  return chemin.replace(/^\/+/, '').split('/').join('__');
}

/** `fr__notre-histoire` → `/fr/notre-histoire`, ou `null` si ce n'est pas une clé. */
export function cheminDeCle(cle: string): string | null {
  if (typeof cle !== 'string' || !cle) return null;
  return cheminDeAdresse(`/${cle.split('__').join('/')}`);
}

/** La langue d'une adresse : son premier segment. */
export function langueDuChemin(chemin: string): Langue {
  return chemin.startsWith('/en') ? 'en' : 'fr';
}

/** Une ligne : espaces et retours à la ligne ramenés à une espace. */
function uneLigne(v: string): string {
  return v.replace(/\s+/g, ' ').trim();
}

function imageValide(v: string): boolean {
  if (!v) return true;
  if (v.length > MAX_IMAGE) return false;
  try {
    return new URL(v).protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Un document de `bleuh_site_seo` tel que le site l'applique — indulgent :
 * un champ illisible est traité comme vide (le texte du site), jamais comme
 * une erreur de page. `null` quand l'identifiant n'est pas une adresse.
 */
export function lireReglage(id: string, data: Record<string, unknown> | null | undefined): ReglageSeo | null {
  const chemin = cheminDeCle(id);
  if (!chemin) return null;
  const d = data ?? {};
  const texte = (v: unknown, max: number) => (typeof v === 'string' ? uneLigne(v).slice(0, max) : '');
  const image = typeof d.ogImage === 'string' ? d.ogImage.trim() : '';
  return {
    cle: id,
    chemin,
    title: texte(d.title, MAX_TITRE),
    description: texte(d.description, MAX_DESCRIPTION),
    ogImage: imageValide(image) ? image : '',
  };
}

/** Un réglage qui ne change rien : les trois champs sont vides. */
export function reglageVide(r: Pick<ReglageSeo, 'title' | 'description' | 'ogImage'>): boolean {
  return !r.title && !r.description && !r.ogImage;
}

/**
 * Ce que Marketing Bleuh accepte d'écrire. Liste blanche stricte : `title`,
 * `description`, `ogImage`, des chaînes. Les textes sont ramenés à une ligne ;
 * l'image doit être une adresse https.
 */
export function validerReglage(body: unknown): Validated<ReglageEcrit> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'Réglage illisible.' };
  }
  const b = body as Record<string, unknown>;
  const inconnus = Object.keys(b).filter((k) => k !== 'title' && k !== 'description' && k !== 'ogImage');
  if (inconnus.length) return { ok: false, error: `Champ non modifiable : ${inconnus.join(', ')}.` };
  for (const k of ['title', 'description', 'ogImage'] as const) {
    if (b[k] !== undefined && typeof b[k] !== 'string') return { ok: false, error: `Le champ ${k} doit être un texte.` };
  }
  const title = uneLigne(String(b.title ?? ''));
  const description = uneLigne(String(b.description ?? ''));
  const ogImage = String(b.ogImage ?? '').trim();
  if (title.length > MAX_TITRE) return { ok: false, error: `Titre trop long (${title.length} caractères, ${MAX_TITRE} au plus).` };
  if (description.length > MAX_DESCRIPTION) {
    return { ok: false, error: `Description trop longue (${description.length} caractères, ${MAX_DESCRIPTION} au plus).` };
  }
  if (!imageValide(ogImage)) return { ok: false, error: 'L’image de partage doit être une adresse https complète.' };
  return { ok: true, value: { title, description, ogImage } };
}
