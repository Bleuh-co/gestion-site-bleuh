import { NextRequest, NextResponse } from "next/server";
import { requireRead } from "@/lib/auth-server";
import { handleError } from "@/lib/products-service";

// GET /api/produits/studio/search — EXTRA (brief §3, #3b).
// Proxy vers Studio Chanv (relai du header Authorization) — à revalider
// côté sécurité (CORS, STUDIO_CHANV_URL, STUDIO_CRON_SECRET) avant portage.
// Équivalent Express : GET /studio/search de routes/site-products.js.
export async function GET(_req: NextRequest) {
  try {
    await requireRead();
    return NextResponse.json(
      { error: "Non implémenté : proxy Studio Chanv à revalider côté sécurité. À venir.", code: "not_implemented" },
      { status: 501 }
    );
  } catch (error) {
    return handleError(error, "GET /api/produits/studio/search");
  }
}
