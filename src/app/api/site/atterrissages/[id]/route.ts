import { NextRequest, NextResponse } from "next/server";
import { requireRead, requireWrite } from "@/lib/auth-server";
import { recordAudit } from "@/lib/audit";
import { reponseErreur } from "@/lib/erreur-metier";
import { getFicheAffichee, getFicheBrute, updateFicheAtterrissage } from "@/lib/atterrissages-store";
import { validerPatchAtterrissage } from "@/lib/atterrissages-pure";

export const runtime = "nodejs";

// GET /api/site/atterrissages/[id] — détail d'une page d'atterrissage.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireRead();
    const { id } = await ctx.params;
    return NextResponse.json(await getFicheAffichee(id, session));
  } catch (error) {
    return reponseErreur(error, "GET /api/site/atterrissages/[id]");
  }
}

/**
 * PATCH /api/site/atterrissages/[id] — la programmation d'une page EXISTANTE
 * (`active`, `debut`, `fin`, `apercu`, `visibilite`, `apres`, `renvoi`,
 * `zones` — liste blanche de `validerPatchAtterrissage`). Le nom, les
 * adresses, les langues et les produits se posent à la demande.
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireWrite();
    const { id } = await ctx.params;

    const body: unknown = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ success: false, message: "Corps de requête JSON invalide." }, { status: 400 });
    }

    const actuelle = await getFicheBrute(id);
    const valide = validerPatchAtterrissage(body as Record<string, unknown>, actuelle);
    if (!valide.ok) {
      return NextResponse.json({ success: false, message: valide.error }, { status: 400 });
    }

    const { avant, fiche } = await updateFicheAtterrissage(id, valide.value, session);

    // Un geste nommé par sauvegarde : l'interrupteur d'abord, puis les dates,
    // puis le reste ; `details` garde toujours la liste complète, avant/après.
    const champs = Object.keys(valide.value);
    const action =
      "active" in valide.value
        ? valide.value.active
          ? "site.atterrissage.allumee"
          : "site.atterrissage.eteinte"
        : champs.some((c) => c === "debut" || c === "fin" || c === "apercu")
          ? "site.atterrissage.programmee"
          : "site.atterrissage.modifiee";
    await recordAudit(session, action, `site/atterrissages/${id}`, { champs, avant, apres: valide.value });

    return NextResponse.json(fiche);
  } catch (error) {
    return reponseErreur(error, "PATCH /api/site/atterrissages/[id]");
  }
}
