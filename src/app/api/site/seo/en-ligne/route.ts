import { NextRequest, NextResponse } from "next/server";
import { requireRead } from "@/lib/auth-server";
import { reponseErreur } from "@/lib/erreur-metier";
import { tetesEnLigne } from "@/lib/bleuh-co-en-ligne";

export const runtime = "nodejs";

/** Au plus autant de pages par appel : l'écran les demande par paquets. */
const MAX_CHEMINS = 24;

/**
 * GET /api/site/seo/en-ligne?chemins=/fr/a,/en/b[&frais=1] — ce que chaque
 * page de bleuh.co dit à Google en ce moment (titre, description, image de
 * partage). `frais=1` relit sans cache : c'est le « Vérifier sur bleuh.co »
 * qui suit un enregistrement.
 */
export async function GET(req: NextRequest) {
  try {
    await requireRead();
    const chemins = (req.nextUrl.searchParams.get("chemins") || "")
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);
    if (!chemins.length || chemins.length > MAX_CHEMINS) {
      return NextResponse.json(
        { success: false, message: `Entre 1 et ${MAX_CHEMINS} adresses par demande.` },
        { status: 400 },
      );
    }
    const frais = req.nextUrl.searchParams.get("frais") === "1";
    return NextResponse.json({ tetes: await tetesEnLigne(chemins, frais) });
  } catch (error) {
    return reponseErreur(error, "GET /api/site/seo/en-ligne");
  }
}
