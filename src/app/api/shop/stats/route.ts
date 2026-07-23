import { NextRequest, NextResponse } from "next/server";
import { requireRead } from "@/lib/auth-server";
import { getStats, shopErrorResponse } from "@/lib/shop-store";

export const runtime = "nodejs";

// GET /api/shop/stats — tableau de bord (lecture seule). Agrégats calculés
// depuis Firestore shop_orders : compteurs de commandes par statut, ventes du
// mois (somme des totaux), meilleurs vendeurs du mois par quantité. Même forme
// de réponse qu'avant ({ totals, sales, topSellers }).
export async function GET(_req: NextRequest) {
  try {
    await requireRead();
    return NextResponse.json(await getStats());
  } catch (error) {
    return shopErrorResponse(error, "GET /api/shop/stats");
  }
}
