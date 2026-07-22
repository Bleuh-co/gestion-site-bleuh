import { NextRequest } from "next/server";
import { requireRead } from "@/lib/auth-server";
import { wooFetch, relayWooJson, shopErrorResponse, TIMEOUTS } from "@/lib/woo-proxy";

export const runtime = "nodejs";

// GET /api/shop/commandes — liste des commandes Woo (lecture seule).
// Proxy vers GET /orders. Query en liste blanche : status, page, search, per_page.
export async function GET(req: NextRequest) {
  try {
    await requireRead();
    const sp = req.nextUrl.searchParams;
    const perPage = Math.min(Number(sp.get("per_page")) || 20, 100);
    const upstream = await wooFetch("/orders", {
      searchParams: {
        status: sp.get("status") || undefined,
        search: sp.get("search") || undefined,
        page: sp.get("page") || undefined,
        per_page: perPage,
        orderby: "date",
        order: "desc",
      },
      timeout: TIMEOUTS.read,
    });
    return await relayWooJson(upstream);
  } catch (error) {
    return shopErrorResponse(error, "GET /api/shop/commandes");
  }
}
