import { NextRequest, NextResponse } from "next/server";
import { requireRead, requireWrite } from "@/lib/auth-server";
import { recordAudit } from "@/lib/audit";
import { wooFetch, relayWooJson, shopErrorResponse, TIMEOUTS } from "@/lib/woo-proxy";

export const runtime = "nodejs";

// GET /api/shop/commandes/[id] — détail d'une commande Woo (lecture seule).
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireRead();
    const { id } = await ctx.params;
    const upstream = await wooFetch(`/orders/${encodeURIComponent(id)}`, { timeout: TIMEOUTS.read });
    return await relayWooJson(upstream);
  } catch (error) {
    return shopErrorResponse(error, "GET /api/shop/commandes/[id]");
  }
}

// ⚠️ ÉCRITURE RÉELLE sur bleuh.shop (PROD). PATCH /api/shop/commandes/[id] —
// change UNIQUEMENT le statut de la commande. Statut en liste blanche stricte.
const ALLOWED_STATUS = ["pending", "processing", "on-hold", "completed", "cancelled", "refunded"] as const;

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
    if (typeof status !== "string" || !ALLOWED_STATUS.includes(status as (typeof ALLOWED_STATUS)[number])) {
      return NextResponse.json({ success: false, message: "Statut de commande invalide." }, { status: 400 });
    }

    const upstream = await wooFetch(`/orders/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: { status },
      timeout: TIMEOUTS.write,
    });

    if (upstream.ok) {
      await recordAudit(session, "shop.order.status", `shop/commandes/${id}`, { status });
    }
    return await relayWooJson(upstream);
  } catch (error) {
    return shopErrorResponse(error, "PATCH /api/shop/commandes/[id]");
  }
}
