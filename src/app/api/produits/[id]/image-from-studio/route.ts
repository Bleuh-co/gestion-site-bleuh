import { NextRequest, NextResponse } from "next/server";
import { requireWrite } from "@/lib/auth-server";
import { handleError } from "@/lib/products-service";

// POST /api/produits/[id]/image-from-studio — EXTRA (brief §3, #9b).
// Télécharge depuis Studio Chanv puis réuploade vers GCS + studio_links —
// mêmes dépendances que /image (adminStorage()) + Studio Chanv. Pas encore
// porté. Équivalent Express : POST /:id/image-from-studio de routes/site-products.js.
export async function POST(_req: NextRequest, _ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireWrite();
    return NextResponse.json(
      { error: "Non implémenté : nécessite adminStorage() (GCS) + Studio Chanv. À venir.", code: "not_implemented" },
      { status: 501 }
    );
  } catch (error) {
    return handleError(error, "POST /api/produits/[id]/image-from-studio");
  }
}
