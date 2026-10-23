import "server-only";
import type { BleuhMailerLiteClient } from "./mailerlite-bleuh";
import type { SessionContext } from "./auth-server";
import { recordAudit } from "./audit";
import { ErreurMetier } from "./erreur-metier";
import { lireEtatsFils } from "./fils-store";
import { ETAT_FIL_VIDE, type EtatFil } from "./fils-pure";
import { supprimerDiscussion } from "./hub-support";
import { idCampagneValide, trierNonEnvoyees, type CampagneNonEnvoyee } from "./campagnes-brouillons-pure";

/**
 * Les campagnes MailerLite Bleuh pas encore parties, avec leur discussion
 * (lot L12). MailerLite reste la source : rien n'est recopié dans Firestore.
 */

export interface CampagneNonEnvoyeeAffichee extends CampagneNonEnvoyee {
  commentaires: EtatFil;
}

type LireFils = typeof lireEtatsFils;

export async function listerNonEnvoyees(
  client: BleuhMailerLiteClient,
  email: string,
  lireFils: LireFils = lireEtatsFils
): Promise<CampagneNonEnvoyeeAffichee[]> {
  const list = trierNonEnvoyees(await client.getUnsentCampaigns());
  const fils = await lireFils("infolettres", list.map((c) => c.id), email);
  return list.map((c) => ({ ...c, commentaires: fils.get(c.id) ?? { ...ETAT_FIL_VIDE } }));
}

/** Supprime un brouillon ; 400 id illisible, 409 s'il n'est plus un brouillon (programmé, envoyé ou déjà supprimé). */
export async function supprimerBrouillon(
  client: BleuhMailerLiteClient,
  id: string,
  session: SessionContext,
  journal: typeof recordAudit = recordAudit,
  supprimerFil: typeof supprimerDiscussion = supprimerDiscussion
): Promise<void> {
  if (!idCampagneValide(id)) throw new ErreurMetier("Campagne introuvable.", 400);
  const r = await client.deleteDraftCampaign(id);
  if (r === "absente") {
    throw new ErreurMetier(
      "Cette campagne n'est plus un brouillon dans MailerLite (programmée, envoyée ou déjà supprimée). Actualisez la liste.",
      409
    );
  }
  await journal(session, "infolettre.brouillon.delete", `mailerlite:${id}`);
  // CONTRAT v2 §3 : au mieux, APRÈS la suppression réussie — un échec est
  // journalisé et ne défait ni ne retarde jamais la suppression du brouillon.
  try {
    const d = await supprimerFil("infolettres", id);
    if (!d.ok) console.warn(`[campagnes-brouillons-store] suppression de la discussion impossible pour ${id}`, d.error);
  } catch (e) {
    console.warn(`[campagnes-brouillons-store] suppression de la discussion impossible pour ${id}`, e);
  }
}
