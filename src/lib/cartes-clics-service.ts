import "server-only";

/**
 * Cartes de clics de bleuh.co — lectures Firestore (onglet Acquisition). La
 * logique vit dans `cartes-clics-pure.ts` ; ce module ne fait que rapatrier
 * les documents de `site_traffic/{jour}/cartes`.
 *
 * Même parti pris que `acquisition-service.ts` : lecture par identifiant de
 * jour connu, jamais par `where`. La LISTE ne lit que les champs de tête
 * (`select`) ; les cartes elles-mêmes (cellules par bloc) ne voyagent que pour
 * la page ouverte.
 */

import { adminDb } from "@/lib/firebase-admin";
import {
  carteDocId,
  fusionnerCartes,
  listerPages,
  type Appareil,
  type CarteDoc,
  type CarteFusion,
  type LignePage,
  type Variante,
} from "@/lib/cartes-clics-pure";

/** Adresse publique du site, celle que Marketing Bleuh rend sous la carte. */
export const SITE_BLEUH = "https://bleuh.co";

const jours = () => adminDb().collection("site_traffic");

export interface ListeCartes {
  site: string;
  pages: LignePage[];
}

export async function lireListeCartes(days: string[]): Promise<ListeCartes> {
  const parJour = await Promise.all(
    days.map((d) =>
      jours()
        .doc(`day_${d}`)
        .collection("cartes")
        .select("page", "appareil", "variante", "vues", "n_clics", "n_morts", "n_rages")
        .get()
        .then((s) => s.docs.map((x) => x.data() as CarteDoc))
    )
  );
  return { site: SITE_BLEUH, pages: listerPages(parJour.flat()) };
}

export async function lireCarte(
  days: string[],
  appareil: Appareil,
  variante: Variante,
  page: string
): Promise<CarteFusion> {
  if (days.length === 0) return fusionnerCartes(page, appareil, variante, []);
  const id = carteDocId(appareil, variante, page);
  const snaps = await adminDb().getAll(...days.map((d) => jours().doc(`day_${d}`).collection("cartes").doc(id)));
  // Le document porte son chemin en champ : une collision d'identifiant
  // (deux chemins réduits au même slug) ne mélange pas deux pages.
  const docs = snaps.filter((s) => s.exists && s.get("page") === page).map((s) => s.data() as CarteDoc);
  return fusionnerCartes(page, appareil, variante, docs);
}
