import "server-only";
import type { Firestore } from "firebase-admin/firestore";
import { adminDb } from "./firebase-admin";
import type { SessionContext } from "./auth-server";
import { ErreurMetier } from "./erreur-metier";
import {
  COLLECTION_SEO,
  cheminDeCle,
  lireReglage,
  reglageVide,
  type ReglageEcrit,
  type ReglageSeo,
} from "./seo-reglages-pure";

/**
 * Accès Firestore aux réglages de Titres et descriptions
 * (`bleuh_site_seo`, base du hub — antigravity-20260107). Les règles vivent
 * dans `seo-reglages-pure.ts`, copie conforme de celui de bleuh.co.
 *
 * UN DOCUMENT PAR ADRESSE RÉGLÉE. Vider les trois champs d'une adresse
 * supprime son document : la page reprend le texte de son code, et la
 * collection ne garde que ce qui change vraiment quelque chose.
 */

type Db = Pick<Firestore, "collection" | "runTransaction">;
const db = (): Db => adminDb();

export interface ReglageAffiche extends ReglageSeo {
  modifieLe: string | null;
  modifiePar: string | null;
}

function affiche(cle: string, data: Record<string, unknown>): ReglageAffiche | null {
  const r = lireReglage(cle, data);
  if (!r) return null;
  return {
    ...r,
    modifieLe: typeof data.updatedAt === "string" ? data.updatedAt : null,
    modifiePar: typeof data.updatedBy === "string" ? data.updatedBy : null,
  };
}

/** Tous les réglages, par clé d'adresse (`fr__notre-histoire`). */
export async function listerReglages(d: Db = db()): Promise<Record<string, ReglageAffiche>> {
  const snap = await d.collection(COLLECTION_SEO).get();
  const out: Record<string, ReglageAffiche> = {};
  for (const doc of snap.docs) {
    const r = affiche(doc.id, doc.data());
    if (r) out[r.cle] = r;
  }
  return out;
}

/**
 * Pose le réglage d'une adresse (déjà validé par `validerReglage`), ou le
 * retire quand les trois champs sont vides. Rend l'avant et l'après pour le
 * journal.
 */
export async function ecrireReglage(
  cle: string,
  valeur: ReglageEcrit,
  session: Pick<SessionContext, "email">,
  d: Db = db(),
): Promise<{ avant: ReglageEcrit; apres: ReglageAffiche | null }> {
  const chemin = cheminDeCle(cle);
  if (!chemin) throw new ErreurMetier("Cette adresse n'est pas une page de bleuh.co.", 404);
  const ref = d.collection(COLLECTION_SEO).doc(cle);
  return d.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const actuel = lireReglage(cle, snap.exists ? snap.data() : {});
    const avant: ReglageEcrit = {
      title: actuel?.title ?? "",
      description: actuel?.description ?? "",
      ogImage: actuel?.ogImage ?? "",
    };
    if (reglageVide(valeur)) {
      if (snap.exists) tx.delete(ref);
      return { avant, apres: null };
    }
    const doc = {
      chemin,
      title: valeur.title,
      description: valeur.description,
      ogImage: valeur.ogImage,
      updatedAt: new Date().toISOString(),
      updatedBy: session.email,
    };
    tx.set(ref, doc);
    return { avant, apres: affiche(cle, doc) };
  });
}
