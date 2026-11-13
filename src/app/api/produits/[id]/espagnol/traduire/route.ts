import { NextRequest, NextResponse } from "next/server";
import { requireWrite } from "@/lib/auth-server";
import { handleError, productsCol } from "@/lib/products-service";
import { TraductionIndisponible, traduireEnEspagnol } from "@/lib/products-es-service";
import { textesDeLaFiche, type FicheSource } from "@/lib/products-es-pure";

// La traduction peut prendre plusieurs dizaines de secondes sur une longue fiche.
export const maxDuration = 120;

// POST /api/produits/[id]/espagnol/traduire → { textes } : une PROPOSITION,
// traduite de l'anglais de la fiche. Rien n'est enregistré ici : l'écran la
// montre, la personne la relit puis enregistre.
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireWrite();
    const { id } = await ctx.params;
    const doc = await productsCol().doc(id).get();
    if (!doc.exists) return NextResponse.json({ error: "Produit introuvable." }, { status: 404 });
    const fiche = doc.data() as FicheSource;
    const textes = await traduireEnEspagnol(textesDeLaFiche(fiche, "en"), textesDeLaFiche(fiche, "fr"));
    return NextResponse.json({ textes });
  } catch (error) {
    if (error instanceof TraductionIndisponible) {
      return NextResponse.json({ error: error.message, code: "traduction_indisponible" }, { status: 503 });
    }
    return handleError(error, "POST /api/produits/[id]/espagnol/traduire");
  }
}
