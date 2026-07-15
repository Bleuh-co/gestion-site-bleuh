import { NextRequest, NextResponse } from "next/server";
import { requireWrite } from "@/lib/auth-server";
import { handleError } from "@/lib/products-service";

// POST /api/produits/[id]/image — EXTRA (brief §3, #9).
// Upload binaire vers GCS (produits/{id}/...) — nécessite d'ajouter
// adminStorage() à firebase-admin.ts (absent aujourd'hui) + vérifier les
// permissions IAM du service account sur le bucket. Pas encore porté.
// Équivalent Express : POST /:id/image de routes/site-products.js.
export async function POST(_req: NextRequest, _ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireWrite();
    return NextResponse.json(
      { error: "Non implémenté : nécessite adminStorage() (GCS) — absent du projet. À venir.", code: "not_implemented" },
      { status: 501 }
    );
  } catch (error) {
    return handleError(error, "POST /api/produits/[id]/image");
  }
}
