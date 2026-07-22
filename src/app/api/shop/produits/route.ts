import { NextRequest } from "next/server";
import { requireRead } from "@/lib/auth-server";
import { wooFetch, relayWooJson, shopErrorResponse, TIMEOUTS } from "@/lib/woo-proxy";

export const runtime = "nodejs";

// GET /api/shop/produits — liste des produits WooCommerce (lecture seule).
// Proxy vers GET /products de l'API REST Woo v3. Query relayée en liste blanche :
// search, category, status, page, per_page (borné à 100 = max Woo).
export async function GET(req: NextRequest) {
  try {
    await requireRead();
    const sp = req.nextUrl.searchParams;
    const perPage = Math.min(Number(sp.get("per_page")) || 100, 100);
    const upstream = await wooFetch("/products", {
      searchParams: {
        search: sp.get("search") || undefined,
        category: sp.get("category") || undefined,
        status: sp.get("status") || undefined,
        page: sp.get("page") || undefined,
        per_page: perPage,
        orderby: "title",
        order: "asc",
      },
      timeout: TIMEOUTS.read,
    });
    return await relayWooJson(upstream);
  } catch (error) {
    return shopErrorResponse(error, "GET /api/shop/produits");
  }
}
