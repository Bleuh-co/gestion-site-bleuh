import { NextRequest, NextResponse } from "next/server";
import { requireWrite } from "@/lib/auth-server";
import { recordAudit } from "@/lib/audit";
import { ErreurMetier, reponseErreur } from "@/lib/erreur-metier";
import { getDemandeBrouillon, getFicheBrute, poserTicketSurFiche } from "@/lib/atterrissages-store";
import { texteDuSignalement } from "@/lib/demande-atterrissage-pure";
import { cleExterne, envoyerSignalement } from "@/lib/hub-support";

export const runtime = "nodejs";

/**
 * POST /api/site/atterrissages/[id]/renvoyer-demande — renvoie le signalement
 * d'une page quand l'envoi au hub a échoué à la création. `external_key` rend
 * le renvoi sans danger : le hub répond avec le MÊME id, sans doublon.
 */
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireWrite();
    const { id } = await ctx.params;

    const fiche = await getFicheBrute(id);
    if (fiche.demande?.ticket) {
      return NextResponse.json({ id, signalement: { ok: true, id: fiche.demande.ticket, created: false } });
    }

    const brouillon = await getDemandeBrouillon(id);
    if (!brouillon) {
      throw new ErreurMetier("Cette fiche n'a pas de demande à renvoyer (page faite avant l'espace).", 409);
    }

    const signalement = await envoyerSignalement({
      sorte: "page",
      external_key: cleExterne("page", id),
      reporterEmail: session.email,
      ...texteDuSignalement(brouillon),
      images: brouillon.images,
      tacheReliee: fiche.demande?.tache ?? null,
      objet: { id, lien: brouillon.ficheUrl },
    });
    if (signalement.ok && signalement.id) {
      await poserTicketSurFiche(id, signalement.id);
      await recordAudit(session, "site.atterrissage.demande_renvoyee", `site/atterrissages/${id}`, { ticket: signalement.id });
    }

    return NextResponse.json({ id, signalement });
  } catch (error) {
    return reponseErreur(error, "POST /api/site/atterrissages/[id]/renvoyer-demande");
  }
}
