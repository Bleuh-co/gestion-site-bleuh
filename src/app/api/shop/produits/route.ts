import { NextRequest, NextResponse } from "next/server";
import { requireRead } from "@/lib/auth-server";
import { listProducts, shopErrorResponse } from "@/lib/shop-store";

export const runtime = "nodejs";

// GET /api/shop/produits — liste des produits (Firestore shop_products,
// catalogue maître). Query en liste blanche : search, category, status, page,
// per_page (borné à 100). Réponse : { items, total, totalPages }.
export async function GET(req: NextRequest) {
  try {
    await requireRead();
    const sp = req.nextUrl.searchParams;
    const result = await listProducts({
      search: sp.get("search") || undefined,
      category: sp.get("category") || undefined,
      status: sp.get("status") || undefined,
      page: Number(sp.get("page")) || 1,
      perPage: Number(sp.get("per_page")) || 100,
    });
    return NextResponse.json(result);
  } catch (error) {
    return shopErrorResponse(error, "GET /api/shop/produits");
  }
}
