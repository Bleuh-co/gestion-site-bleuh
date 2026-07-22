import { NextRequest, NextResponse } from "next/server";
import { requireRead, requireWrite } from "@/lib/auth-server";
import { recordAudit } from "@/lib/audit";
import { wooFetch, relayWooJson, shopErrorResponse, TIMEOUTS } from "@/lib/woo-proxy";

export const runtime = "nodejs";

// GET /api/shop/produits/[id] — détail d'un produit Woo (lecture seule).
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireRead();
    const { id } = await ctx.params;
    const upstream = await wooFetch(`/products/${encodeURIComponent(id)}`, { timeout: TIMEOUTS.read });
    return await relayWooJson(upstream);
  } catch (error) {
    return shopErrorResponse(error, "GET /api/shop/produits/[id]");
  }
}

// ⚠️ ÉCRITURE RÉELLE sur bleuh.shop (PROD). PATCH /api/shop/produits/[id] —
// met à jour un produit Woo. Champs en LISTE BLANCHE STRICTE : on ne relaie
// jamais un body arbitraire du client vers la boutique live.
const ALLOWED_FIELDS = [
  "regular_price",
  "sale_price",
  "status",
  "manage_stock",
  "stock_quantity",
  "stock_status",
] as const;

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
    if (!body || typeof body !== "object") {
      return NextResponse.json({ success: false, message: "Corps de requête JSON invalide." }, { status: 400 });
    }
    const src = body as Record<string, unknown>;

    const payload: Record<string, unknown> = {};
    for (const field of ALLOWED_FIELDS) {
      if (src[field] !== undefined) payload[field] = src[field];
    }
    if (payload.status !== undefined && payload.status !== "publish" && payload.status !== "draft") {
      return NextResponse.json({ success: false, message: "Statut invalide (publish|draft)." }, { status: 400 });
    }
    if (
      payload.stock_status !== undefined &&
      payload.stock_status !== "instock" &&
      payload.stock_status !== "outofstock" &&
      payload.stock_status !== "onbackorder"
    ) {
      return NextResponse.json({ success: false, message: "Statut de stock invalide." }, { status: 400 });
    }
    if (Object.keys(payload).length === 0) {
      return NextResponse.json({ success: false, message: "Aucun champ modifiable fourni." }, { status: 400 });
    }

    const upstream = await wooFetch(`/products/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: payload,
      timeout: TIMEOUTS.write,
    });

    if (upstream.ok) {
      await recordAudit(session, "shop.product.update", `shop/produits/${id}`, { fields: Object.keys(payload) });
    }
    return await relayWooJson(upstream);
  } catch (error) {
    return shopErrorResponse(error, "PATCH /api/shop/produits/[id]");
  }
}
