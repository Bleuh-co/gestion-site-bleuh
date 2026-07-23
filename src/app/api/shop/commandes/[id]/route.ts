import { NextRequest, NextResponse } from "next/server";
import { requireRead, requireWrite } from "@/lib/auth-server";
import { recordAudit } from "@/lib/audit";
import {
  getOrder,
  updateOrderStatus,
  shopErrorResponse,
  ORDER_STATUSES,
  type OrderStatus,
} from "@/lib/shop-store";

export const runtime = "nodejs";

// GET /api/shop/commandes/[id] — détail d'une commande (Firestore shop_orders,
// docId = id Firestore auto-généré ; le numéro "SB-####" est le champ `number`).
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireRead();
    const { id } = await ctx.params;
    return NextResponse.json(await getOrder(id));
  } catch (error) {
    return shopErrorResponse(error, "GET /api/shop/commandes/[id]");
  }
}

// PATCH /api/shop/commandes/[id] — change UNIQUEMENT le statut de la commande.
// Statuts de NOTRE boutique en liste blanche stricte (voir shop-store.ts —
// les statuts Woo "on-hold"/"failed" n'existent plus).
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireWrite();
    const { id } = await ctx.params;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ success: false, message: "Corps de requête JSON invalide." }, { status: 400 });
    }
    const status = body && typeof body === "object" ? (body as Record<string, unknown>).status : undefined;
    if (typeof status !== "string" || !ORDER_STATUSES.includes(status as OrderStatus)) {
      return NextResponse.json({ success: false, message: "Statut de commande invalide." }, { status: 400 });
    }

    const updated = await updateOrderStatus(id, status as OrderStatus);
    await recordAudit(session, "shop.order.status", `shop/commandes/${id}`, { status });
    return NextResponse.json(updated);
  } catch (error) {
    return shopErrorResponse(error, "PATCH /api/shop/commandes/[id]");
  }
}
