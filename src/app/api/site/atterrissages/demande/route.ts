import { NextRequest, NextResponse } from "next/server";
import { requireWrite } from "@/lib/auth-server";
import { recordAudit } from "@/lib/audit";
import { reponseErreur } from "@/lib/erreur-metier";
import { dateLongue, phrasesDeLaPage } from "@/lib/atterrissages-pure";
import {
  adresseDejaPrise,
  creerFicheAtterrissage,
  poserTicketSurFiche,
  resoudreProduits,
  type BrouillonSignalement,
} from "@/lib/atterrissages-store";
import { texteDuSignalement, validerDemande } from "@/lib/demande-atterrissage-pure";
import { cleExterne, envoyerSignalement } from "@/lib/hub-support";

export const runtime = "nodejs";

/** `https://…/pages-atterrissage/<id>` — `null` sans adresse publique en https (le hub l'exige). */
function ficheUrlPublique(id: string): string | null {
  const base = (process.env.APP_PUBLIC_URL || "").trim().replace(/\/+$/, "");
  if (!base.startsWith("https://")) return null;
  return `${base}/pages-atterrissage/${id}`;
}

/**
 * POST /api/site/atterrissages/demande — « Demander une page » (lot L10).
 *
 * Crée DEUX choses : la fiche (« En préparation ») et un signalement « Page »
 * dans Support Web, file Bleuh (`POST /api/support/service`, intégration
 * `marketing_bleuh`). Si le hub ne répond pas, la fiche reste créée : son
 * brouillon (`demande_brouillon`) permet de renvoyer la demande mot pour mot.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireWrite();

    const body: unknown = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ success: false, message: "Corps de requête JSON invalide." }, { status: 400 });
    }

    const valide = validerDemande(body as Record<string, unknown>);
    if (!valide.ok) {
      return NextResponse.json({ success: false, message: valide.error }, { status: 400 });
    }
    const entree = valide.value;
    const id = entree.adresseFr;

    if (await adresseDejaPrise(entree.adresseFr, entree.adresseEn)) {
      return NextResponse.json(
        { success: false, message: "Cette adresse est déjà prise par une autre page : choisissez-en une autre." },
        { status: 409 }
      );
    }

    const ficheUrl = ficheUrlPublique(id);
    if (!ficheUrl) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Configuration incomplète (APP_PUBLIC_URL absente ou pas en https) : impossible de fabriquer le lien de la fiche pour l'équipe du site.",
        },
        { status: 501 }
      );
    }

    const produitsNoms = (await resoudreProduits(entree.produits)).map((p) => p.nom.fr || p.id);

    const brouillon: BrouillonSignalement = {
      nom: entree.nom,
      adresseFr: entree.adresseFr,
      adresseEn: entree.adresseEn,
      zones: entree.zones,
      langues: entree.langues,
      demandeurNom: session.displayName || session.email,
      aQuoiSert: entree.mode === "tache" ? null : entree.aQuoiSert,
      aChanger: entree.aChanger,
      maquetteLien: entree.maquetteLien,
      nombreCaptures: entree.captures.length,
      produits: produitsNoms,
      periode: entree.debut ? phrasesDeLaPage({ debut: entree.debut, fin: entree.fin }, "fr").periode : null,
      visibilite: entree.visibilite,
      pretePourLe: entree.pretePourLe ? dateLongue(entree.pretePourLe, "fr") : null,
      ficheUrl,
      images: entree.captures,
    };

    await creerFicheAtterrissage(
      {
        id,
        nom: entree.nom,
        adresseFr: entree.adresseFr,
        adresseEn: entree.adresseEn,
        zones: entree.zones,
        langues: entree.langues,
        debut: entree.debut,
        fin: entree.fin,
        visibilite: entree.visibilite,
        produits: entree.produits,
        demandePar: session.email,
        demandeTache: entree.tacheId,
      },
      brouillon
    );
    await recordAudit(session, "site.atterrissage.demandee", `site/atterrissages/${id}`, {
      mode: entree.mode,
      tacheId: entree.tacheId,
      zones: entree.zones,
    });

    const signalement = await envoyerSignalement({
      sorte: "page",
      external_key: cleExterne("page", id),
      reporterEmail: session.email,
      ...texteDuSignalement(brouillon),
      images: entree.captures,
      tacheReliee: entree.tacheId,
      objet: { id, lien: ficheUrl },
    });
    if (signalement.ok && signalement.id) {
      await poserTicketSurFiche(id, signalement.id);
    }

    return NextResponse.json({ id, signalement }, { status: 201 });
  } catch (error) {
    return reponseErreur(error, "POST /api/site/atterrissages/demande");
  }
}
