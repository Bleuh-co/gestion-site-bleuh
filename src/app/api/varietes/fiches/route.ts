import { NextResponse } from "next/server";
import { requireRead } from "@/lib/auth-server";
import { handleError } from "@/lib/products-service";
import { listEditorials } from "@/lib/variety-editorials";

export const runtime = "nodejs";

// GET /api/varietes/fiches — toutes les fiches éditoriales.
//
// La collection compte au plus une fiche par variété du vocabulaire (~140
// lignes), et les deux écrans qui l'utilisent (la liste des variétés, le
// formulaire produit) en ont besoin en entier pour rapprocher chaque nom de
// sa fiche. On la renvoie donc d'un bloc plutôt que d'exposer une recherche.
export async function GET() {
  try {
    await requireRead();
    const data = await listEditorials();
    return NextResponse.json({ success: true, count: data.length, data });
  } catch (error) {
    return handleError(error, "GET /api/varietes/fiches");
  }
}
