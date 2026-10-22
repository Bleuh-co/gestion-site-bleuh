import "server-only";
import type { Firestore } from "firebase-admin/firestore";
import { adminDb } from "./firebase-admin";
import { ETAT_FIL_VIDE, etatPourMoi, filIdDe, type EspaceFil, type EtatFil } from "./fils-pure";

/**
 * Les compteurs « Commentaires » d'une liste d'objets, lus dans `app_fils`
 * (collection du hub, base partagée — adminDb(), comme `tickets` et
 * `user_app_roles`). LECTURE SEULE : seul GANDALF écrit les discussions.
 *
 * Un seul `getAll` pour toute la page affichée. Une panne de lecture ne casse
 * pas la liste : les cellules restent à zéro, le volet reste ouvrable (il
 * relit tout, côté hub).
 */

const COLLECTION = "app_fils";

/** L'ID Firestore de l'app dans `apps` — même source que auth-server.ts. */
function appId(): string {
  return (process.env.GESTIONSITEBLEUH_APP_ID || "").trim();
}

/** { objet → état } ; un objet sans discussion encore = compte 0. */
export async function lireEtatsFils(
  espace: EspaceFil,
  objets: string[],
  email: string,
  db: Pick<Firestore, "collection" | "getAll"> = adminDb()
): Promise<Map<string, EtatFil>> {
  const out = new Map<string, EtatFil>();
  const app = appId();
  const paires = objets
    .map((objet) => ({ objet, filId: filIdDe({ appId: app, espace, objet }) }))
    .filter((p) => p.filId);
  for (const objet of objets) out.set(objet, { ...ETAT_FIL_VIDE });
  if (!paires.length) return out;
  for (const p of paires) out.set(p.objet, { filId: p.filId, compte: 0, nouveau: false });
  try {
    const docs = await db.getAll(...paires.map((p) => db.collection(COLLECTION).doc(p.filId)));
    docs.forEach((d, i) => {
      if (!d.exists) return;
      out.set(paires[i].objet, { filId: paires[i].filId, ...etatPourMoi(d.data(), email) });
    });
  } catch (e) {
    console.warn("[fils-store] lecture app_fils impossible", e);
  }
  return out;
}
