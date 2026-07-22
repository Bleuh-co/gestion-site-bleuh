import { NextRequest, NextResponse } from "next/server";
import { requireRead } from "@/lib/auth-server";
import { wooFetch, shopErrorResponse, TIMEOUTS } from "@/lib/woo-proxy";

export const runtime = "nodejs";

/** Parse best-effort du corps JSON d'un rapport Woo ; [] si non-JSON/erreur. */
async function readJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!res.ok) return [];
  try {
    return JSON.parse(text);
  } catch {
    return [];
  }
}

// GET /api/shop/stats — tableau de bord (lecture seule). Agrège en parallèle
// trois rapports Woo : compteurs de commandes par statut, ventes du mois,
// meilleurs vendeurs du mois. Chaque rapport dégrade en [] sans casser les autres.
export async function GET(_req: NextRequest) {
  try {
    await requireRead();
    const [totals, sales, topSellers] = await Promise.all([
      wooFetch("/reports/orders/totals", { timeout: TIMEOUTS.stats }).then(readJson),
      wooFetch("/reports/sales", { searchParams: { period: "month" }, timeout: TIMEOUTS.stats }).then(readJson),
      wooFetch("/reports/top_sellers", { searchParams: { period: "month" }, timeout: TIMEOUTS.stats }).then(readJson),
    ]);
    return NextResponse.json({ totals, sales, topSellers });
  } catch (error) {
    return shopErrorResponse(error, "GET /api/shop/stats");
  }
}
