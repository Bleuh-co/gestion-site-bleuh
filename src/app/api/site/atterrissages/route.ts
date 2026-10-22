import { NextResponse } from "next/server";
import { requireRead } from "@/lib/auth-server";
import { reponseErreur } from "@/lib/erreur-metier";
import { listFichesAffichees } from "@/lib/atterrissages-store";

export const runtime = "nodejs";

/**
 * GET /api/site/atterrissages — toutes les pages d'atterrissage de bleuh.co,
 * avec leur état calculé, leurs phrases FR/EN, leurs produits (point de vente,
 * jamais de prix), l'état de leur demande et de leur discussion (lot L10).
 */
export async function GET() {
  try {
    const session = await requireRead();
    return NextResponse.json({ items: await listFichesAffichees(session) });
  } catch (error) {
    return reponseErreur(error, "GET /api/site/atterrissages");
  }
}
