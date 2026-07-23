import { NextRequest, NextResponse } from "next/server";
import { requireRead } from "@/lib/auth-server";
import { listOrders, shopErrorResponse } from "@/lib/shop-store";

export const runtime = "nodejs";

// GET /api/shop/commandes — liste des commandes (Firestore shop_orders,
// numérotation SB-####). Query en liste blanche : status, search, page,
// per_page. Réponse : { items, total, totalPages }, plus récentes d'abord.
export async function GET(req: NextRequest) {
  try {
    await requireRead();
    const sp = req.nextUrl.searchParams;
    const result = await listOrders({
      status: sp.get("status") || undefined,
      search: sp.get("search") || undefined,
      page: Number(sp.get("page")) || 1,
      perPage: Number(sp.get("per_page")) || 20,
    });
    return NextResponse.json(result);
  } catch (error) {
    return shopErrorResponse(error, "GET /api/shop/commandes");
  }
}
