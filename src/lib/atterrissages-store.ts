import "server-only";
import type { Firestore } from "firebase-admin/firestore";
import { adminDb } from "./firebase-admin";
import { recordAudit } from "./audit";
import type { SessionContext } from "./auth-server";
import { ErreurMetier } from "./erreur-metier";
import { PRODUCTS_COLLECTION } from "./products-service";
import {
  COLLECTION_ATTERRISSAGES,
  etatDeLaPage,
  lireFiche,
  phrasesDeLaPage,
  type Bilingual,
  type EntreeAtterrissagePatch,
  type EtatPage,
  type FicheAtterrissage,
  type Langue,
  type PhrasesDeLaPage,
  type Visibilite,
  type Zone,
} from "./atterrissages-pure";
import type { DonneesTexteSignalement } from "./demande-atterrissage-pure";
import type { EtatFil } from "./fils-pure";
import { lireEtatsFils } from "./fils-store";

/**
 * Accès Firestore aux pages d'atterrissage de bleuh.co
 * (`bleuh_site_atterrissages`, base du hub — antigravity-20260107). Les règles
 * vivent dans `atterrissages-pure.ts` ; ici on lit, on écrit, et on résout ce
 * que l'écran doit montrer sans re-requêter (produits, demande d'origine,
 * discussion). Porté de marketing-mdh/src/lib/atterrissages-store.ts
 * (lot L10), sans offre ni barre d'annonces.
 *
 * MARKETING BLEUH ÉVALUE TOUJOURS `production = true` : ce que Daphnée voit
 * est ce que voit le visiteur EN CE MOMENT sur bleuh.co, jamais l'aperçu de
 * la préprod.
 */

const TICKETS = "tickets"; // collection du hub — lecture seule, jamais écrite ici.

type Db = Pick<Firestore, "collection" | "getAll">;
const db = (): Db => adminDb();
const fiches = (d: Db = db()) => d.collection(COLLECTION_ATTERRISSAGES);

/** Le brouillon posé sur la fiche à sa création : le texte, PLUS les captures. */
export interface BrouillonSignalement extends DonneesTexteSignalement {
  images: string[];
}

/** Où le produit se trouve : jamais un prix (bleuh.co ne vend rien). */
export type PointDeVente = "SQDC" | "OCS";

export interface ProduitDeLaFiche {
  id: string;
  nom: Bilingual;
  image: string;
  pointsDeVente: PointDeVente[];
}

export interface DemandeInfo {
  statut: string | null;
  assigneeEmail: string | null;
  regleLe: string | null;
}

export interface FicheAffichee extends FicheAtterrissage {
  etat: EtatPage;
  phrases: { fr: PhrasesDeLaPage; en: PhrasesDeLaPage };
  produitsResolus: ProduitDeLaFiche[];
  demandeInfo: DemandeInfo | null;
  /** La discussion de la page (`app_fils`, dans GANDALF) : nombre et « nouveau » pour soi. */
  commentaires: EtatFil;
  /** La demande n'est jamais arrivée à Support Web, mais son brouillon est sur la fiche. */
  peutRenvoyer: boolean;
  /** Page faite avant l'espace, rangée en fiche par l'amorçage : le jour où elle l'a été. */
  rangeeLe: string | null;
  /** Les adresses à ouvrir : bleuh.co et sa préprod. */
  urls: { site: string; preprod: string | null };
}

const SITE = "https://bleuh.co";

/** L'adresse de la préprod de bleuh.co (`SITEBLEUH_PREPROD_URL`, posée au lot L9), sans barre finale. */
function preprod(): string | null {
  const u = (process.env.SITEBLEUH_PREPROD_URL || "").trim().replace(/\/+$/, "");
  return u.startsWith("https://") ? u : null;
}

function urlsDe(fiche: FicheAtterrissage): FicheAffichee["urls"] {
  // Une page Canada seulement s'ouvre d'abord en anglais : c'est là qu'on la regarde.
  const locale: Langue = fiche.zones.includes("qc") || !fiche.adresse.en ? "fr" : "en";
  const chemin = `/${locale}/${locale === "fr" ? fiche.adresse.fr : fiche.adresse.en}`;
  const p = preprod();
  return { site: `${SITE}${chemin}`, preprod: p ? `${p}${chemin}` : null };
}

function peutRenvoyerDe(fiche: FicheAtterrissage, raw: Record<string, unknown>): boolean {
  return !fiche.demande?.ticket && !!raw.demande_brouillon && typeof raw.demande_brouillon === "object";
}

function rangeeLeDe(raw: Record<string, unknown>): string | null {
  return typeof raw.rangee_le === "string" && raw.rangee_le ? raw.rangee_le : null;
}

/** Un instant Firestore (Timestamp, chaîne ISO ou rien) → ISO, ou `null`. */
function versIso(v: unknown): string | null {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (v instanceof Date) return v.toISOString();
  const asTs = v as { toDate?: () => Date };
  if (typeof asTs.toDate === "function") {
    try {
      return asTs.toDate().toISOString();
    } catch {
      return null;
    }
  }
  return null;
}

/** L'état de la demande d'origine — lecture SEULE de `tickets/{id}` : le ticket appartient à Support Web. */
export async function lireTicket(ticketId: string): Promise<DemandeInfo | null> {
  try {
    const snap = await db().collection(TICKETS).doc(ticketId).get();
    if (!snap.exists) return null;
    const d = snap.data() as Record<string, unknown>;
    return {
      statut: typeof d.status === "string" ? d.status : null,
      assigneeEmail: typeof d.assigneeEmail === "string" ? d.assigneeEmail : null,
      regleLe: versIso(d.resolvedAt ?? d.closedAt ?? d.updatedAt),
    };
  } catch (e) {
    console.warn("[atterrissages-store] lecture tickets/" + ticketId + " impossible", e);
    return null;
  }
}

/**
 * Pose `livree: true` quand le signalement d'origine est RÉGLÉ et que la fiche
 * ne le sait pas encore — à la lecture, sans attendre un geste. `session` est
 * l'acteur du journal : c'est la personne qui CONSULTE qui déclenche.
 */
async function rafraichirLivraison(fiche: FicheAtterrissage, info: DemandeInfo | null, session: SessionContext): Promise<FicheAtterrissage> {
  if (fiche.livree || info?.statut !== "RESOLVED") return fiche;
  try {
    await fiches().doc(fiche.id).update({ livree: true, modifie_le: new Date().toISOString(), modifie_par: session.email });
    await recordAudit(session, "site.atterrissage.livree", `site/atterrissages/${fiche.id}`, {
      ticket: fiche.demande?.ticket ?? null,
    });
    return { ...fiche, livree: true };
  } catch (e) {
    console.warn("[atterrissages-store] passage à « livrée » impossible pour " + fiche.id, e);
    return fiche;
  }
}

/** Les produits de la fiche (collection `products`, id = slug français), avec leur point de vente. */
export async function resoudreProduits(ids: string[], d: Db = db()): Promise<ProduitDeLaFiche[]> {
  if (ids.length === 0) return [];
  const docs = await d.getAll(...ids.map((id) => d.collection(PRODUCTS_COLLECTION).doc(id)));
  return docs.map((doc, i) => {
    if (!doc.exists) return { id: ids[i], nom: { fr: ids[i], en: ids[i] }, image: "", pointsDeVente: [] };
    const raw = doc.data() as Record<string, unknown>;
    const nom = (raw.name ?? {}) as Record<string, unknown>;
    const images = (raw.images ?? {}) as Record<string, unknown>;
    const provinces = Array.isArray(raw.provinces) ? raw.provinces : [];
    const pointsDeVente: PointDeVente[] = [];
    if (provinces.includes("qc")) pointsDeVente.push("SQDC");
    if (provinces.includes("on")) pointsDeVente.push("OCS");
    return {
      id: doc.id,
      nom: { fr: String(nom.fr ?? ""), en: String(nom.en ?? "") },
      image: typeof images.main === "string" ? images.main : "",
      pointsDeVente,
    };
  });
}

async function afficher(
  fiche: FicheAtterrissage,
  raw: Record<string, unknown>,
  session: SessionContext,
  commentaires: EtatFil
): Promise<FicheAffichee> {
  const demandeInfo = fiche.demande?.ticket ? await lireTicket(fiche.demande.ticket) : null;
  const vivante = await rafraichirLivraison(fiche, demandeInfo, session);
  const produitsResolus = await resoudreProduits(vivante.produits).catch((e) => {
    console.warn("[atterrissages-store] produits illisibles pour " + fiche.id, e);
    return [] as ProduitDeLaFiche[];
  });
  return {
    ...vivante,
    etat: etatDeLaPage(vivante, Date.now(), true),
    phrases: { fr: phrasesDeLaPage(vivante, "fr"), en: phrasesDeLaPage(vivante, "en") },
    produitsResolus,
    demandeInfo,
    commentaires,
    peutRenvoyer: peutRenvoyerDe(vivante, raw),
    rangeeLe: rangeeLeDe(raw),
    urls: urlsDe(vivante),
  };
}

/** Rang d'état pour le tri de la liste : ce qui est vivant ou imminent d'abord. */
export function rangEtat(e: EtatPage): number {
  return ["en-ligne", "programmee", "prete", "preparation", "eteinte", "terminee"].indexOf(e);
}

const ILLISIBLE = "Cette fiche est illisible (date ou zone invalide en base) — prévenir Shadowfax.";

/** La fiche BRUTE (sans enrichissement), pour valider un PATCH contre son état actuel. */
export async function getFicheBrute(id: string): Promise<FicheAtterrissage> {
  const snap = await fiches().doc(id).get();
  if (!snap.exists) throw new ErreurMetier("Page d'atterrissage introuvable.", 404);
  const fiche = lireFiche(id, snap.data());
  if (!fiche) throw new ErreurMetier(ILLISIBLE, 500);
  return fiche;
}

/** Toutes les fiches lisibles, augmentées — sans pagination (une page d'atterrissage est un geste de marque, pas une donnée de masse). */
export async function listFichesAffichees(session: SessionContext): Promise<FicheAffichee[]> {
  const snap = await fiches().get();
  const lisibles: { fiche: FicheAtterrissage; raw: Record<string, unknown> }[] = [];
  for (const d of snap.docs) {
    const raw = d.data() as Record<string, unknown>;
    const f = lireFiche(d.id, raw);
    if (f) lisibles.push({ fiche: f, raw });
    else console.error(`atterrissages-store: fiche illisible, ignorée de la liste — ${JSON.stringify(d.id)}`);
  }
  const fils = await lireEtatsFils("pages", lisibles.map((l) => l.fiche.id), session.email);
  const affichees = await Promise.all(lisibles.map((l) => afficher(l.fiche, l.raw, session, fils.get(l.fiche.id)!)));
  return affichees.sort((a, b) => rangEtat(a.etat) - rangEtat(b.etat) || a.nom.localeCompare(b.nom, "fr"));
}

export async function getFicheAffichee(id: string, session: SessionContext): Promise<FicheAffichee> {
  const snap = await fiches().doc(id).get();
  if (!snap.exists) throw new ErreurMetier("Page d'atterrissage introuvable.", 404);
  const raw = snap.data() as Record<string, unknown>;
  const fiche = lireFiche(id, raw);
  if (!fiche) throw new ErreurMetier(ILLISIBLE, 500);
  const fils = await lireEtatsFils("pages", [id], session.email);
  return afficher(fiche, raw, session, fils.get(id)!);
}

/**
 * Applique un PATCH déjà validé (`validerPatchAtterrissage`). Refuse d'allumer
 * une page pas encore livrée : l'interrupteur est grisé à l'écran, et le
 * serveur tient la même règle contre un appel direct.
 */
export async function updateFicheAtterrissage(
  id: string,
  patch: EntreeAtterrissagePatch,
  session: SessionContext
): Promise<{ avant: Record<string, unknown>; fiche: FicheAtterrissage }> {
  const ref = fiches().doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new ErreurMetier("Page d'atterrissage introuvable.", 404);
  const actuelle = lireFiche(id, snap.data());
  if (!actuelle) throw new ErreurMetier(ILLISIBLE, 500);

  if (patch.active === true && !actuelle.livree) {
    throw new ErreurMetier("Cette page n'est pas encore livrée par l'équipe du site : impossible de l'activer pour l'instant.", 409);
  }

  const avant: Record<string, unknown> = {};
  for (const champ of Object.keys(patch)) avant[champ] = (actuelle as unknown as Record<string, unknown>)[champ];

  await ref.update({ ...patch, modifie_le: new Date().toISOString(), modifie_par: session.email });
  const nouvelle = lireFiche(id, { ...(snap.data() as Record<string, unknown>), ...patch });
  if (!nouvelle) throw new ErreurMetier("La mise à jour a produit une fiche illisible — annulée.", 500);
  return { avant, fiche: nouvelle };
}

// ─────────────────────────────────────────────────────────────
// « Demander une page » — la fiche, et le brouillon de son signalement pour
// pouvoir le renvoyer après une panne du hub.
// ─────────────────────────────────────────────────────────────

export interface CreationFiche {
  id: string;
  nom: string;
  adresseFr: string;
  adresseEn: string;
  zones: Zone[];
  langues: Langue[];
  debut: string | null;
  fin: string | null;
  visibilite: Visibilite;
  produits: string[];
  demandePar: string;
  demandeTache: string | null;
}

/** L'adresse est-elle déjà prise, en français OU en anglais, par une autre fiche ? */
export async function adresseDejaPrise(adresseFr: string, adresseEn: string): Promise<boolean> {
  const snap = await fiches().get();
  const cherchees = new Set([adresseFr, adresseEn].filter(Boolean));
  return snap.docs.some((d) => {
    if (cherchees.has(d.id)) return true;
    const a = ((d.data() as Record<string, unknown>).adresse ?? {}) as Record<string, unknown>;
    return cherchees.has(String(a.fr ?? "")) || cherchees.has(String(a.en ?? ""));
  });
}

/**
 * Crée la fiche, « En préparation » (`livree: false`, `active: false`).
 * `demande_brouillon` est un champ propre à Marketing Bleuh : le site ne le
 * lit jamais. `.create()`, pas `.set()` : échoue si l'adresse vient d'être
 * prise, même en cas de course entre deux demandes.
 */
export async function creerFicheAtterrissage(c: CreationFiche, brouillon: BrouillonSignalement): Promise<void> {
  const maintenant = new Date().toISOString();
  try {
    await fiches().doc(c.id).create({
      nom: c.nom,
      adresse: { fr: c.adresseFr, en: c.adresseEn },
      zones: c.zones,
      langues: c.langues,
      active: false,
      livree: false,
      debut: c.debut,
      fin: c.fin,
      apercu: null,
      visibilite: c.visibilite,
      apres: "terminee",
      renvoi: null,
      produits: c.produits,
      demande: { ticket: null, tache: c.demandeTache, par: c.demandePar, le: maintenant },
      cree_le: maintenant,
      cree_par: c.demandePar,
      demande_brouillon: brouillon,
    });
  } catch {
    throw new ErreurMetier("Cette adresse est déjà prise par une autre page (ou vient de l'être) : choisissez-en une autre.", 409);
  }
}

/** Pose l'identifiant du signalement créé, une fois l'envoi au hub réussi. */
export async function poserTicketSurFiche(id: string, ticketId: string): Promise<void> {
  await fiches().doc(id).update({ "demande.ticket": ticketId });
}

/** Le brouillon du signalement d'une fiche, pour le renvoyer mot pour mot. `null` si elle n'en a pas. */
export async function getDemandeBrouillon(id: string): Promise<BrouillonSignalement | null> {
  const snap = await fiches().doc(id).get();
  if (!snap.exists) throw new ErreurMetier("Page d'atterrissage introuvable.", 404);
  const b = (snap.data() as Record<string, unknown>)?.demande_brouillon;
  return b && typeof b === "object" ? (b as BrouillonSignalement) : null;
}
