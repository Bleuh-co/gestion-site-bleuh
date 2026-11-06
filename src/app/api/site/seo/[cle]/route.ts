import { NextRequest, NextResponse } from "next/server";
import { requireWrite } from "@/lib/auth-server";
import { recordAudit } from "@/lib/audit";
import { reponseErreur } from "@/lib/erreur-metier";
import { validerReglage } from "@/lib/seo-reglages-pure";
import { ecrireReglage } from "@/lib/seo-reglages-store";

export const runtime = "nodejs";

/**
 * PUT /api/site/seo/[cle] — le titre, la description et l'image de partage
 * d'une adresse de bleuh.co (`fr__notre-histoire`). Les trois champs vides
 * retirent le réglage : la page reprend le texte de son code. bleuh.co le
 * relit en moins d'une minute, sans mise en ligne.
 */
export async function PUT(req: NextRequest, ctx: { params: Promise<{ cle: string }> }) {
  try {
    const session = await requireWrite();
    const { cle } = await ctx.params;
    const body: unknown = await req.json().catch(() => null);
    const valide = validerReglage(body);
    if (!valide.ok) return NextResponse.json({ success: false, message: valide.error }, { status: 400 });

    const { avant, apres } = await ecrireReglage(cle, valide.value, session);
    await recordAudit(session, apres ? "site.seo.regle" : "site.seo.retire", `site/seo/${cle}`, {
      avant,
      apres: valide.value,
    });
    return NextResponse.json({ success: true, reglage: apres });
  } catch (error) {
    return reponseErreur(error, "PUT /api/site/seo/[cle]");
  }
}
