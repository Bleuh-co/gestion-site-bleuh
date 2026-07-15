import { NextResponse } from "next/server";
import { requireRead } from "@/lib/auth-server";
import { handleError } from "@/lib/products-service";

// GET /api/produits/master-options — EXTRA (brief §3, #1).
// Nécessite l'API Google Sheets (MasterDBProducts) — pas encore portée.
// Équivalent Express : GET /master-options de routes/site-products.js.
export async function GET() {
  try {
    await requireRead();
    return NextResponse.json(
      { error: "Non implémenté : dépend de l'API Google Sheets (MasterDBProducts). À venir.", code: "not_implemented" },
      { status: 501 }
    );
  } catch (error) {
    return handleError(error, "GET /api/produits/master-options");
  }
}
