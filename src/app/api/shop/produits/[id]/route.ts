import { NextRequest, NextResponse } from "next/server";
import { requireRead, requireWrite } from "@/lib/auth-server";
import { recordAudit } from "@/lib/audit";
import { getProduct, updateProduct, shopErrorResponse, type ProductPatch } from "@/lib/shop-store";

export const runtime = "nodejs";

// GET /api/shop/produits/[id] — détail d'un produit (Firestore shop_products).
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireRead();
    const { id } = await ctx.params;
    return NextResponse.json(await getProduct(id));
  } catch (error) {
    return shopErrorResponse(error, "GET /api/shop/produits/[id]");
  }
}

// PATCH /api/shop/produits/[id] — met à jour un produit du catalogue maître
// (Firestore). Champs en LISTE BLANCHE STRICTE : on n'écrit jamais un body
// arbitraire du client dans le document.
const ALLOWED_FIELDS = [
  "regular_price",
  "sale_price",
  "status",
  "manage_stock",
  "stock_quantity",
  "stock_status",
] as const;

// Format monétaire : nombre positif, 2 décimales max (ex. "19.99", "5").
const PRICE_RE = /^\d+(\.\d{1,2})?$/;

function isValidPrice(v: unknown): boolean {
  return typeof v === "string" && PRICE_RE.test(v);
}

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
    if (payload.manage_stock !== undefined && typeof payload.manage_stock !== "boolean") {
      return NextResponse.json({ success: false, message: "manage_stock invalide (booléen)." }, { status: 400 });
    }
    // regular_price : nombre positif requis (jamais de chaîne vide — un produit
    // doit toujours avoir un prix régulier valide).
    if (payload.regular_price !== undefined && !isValidPrice(payload.regular_price)) {
      return NextResponse.json(
        { success: false, message: "Prix régulier invalide (nombre positif, 2 décimales max)." },
        { status: 400 }
      );
    }
    // sale_price : nombre positif, OU chaîne vide ("" efface le prix promo —
    // comportement conservé de l'ancien module).
    if (
      payload.sale_price !== undefined &&
      payload.sale_price !== "" &&
      !isValidPrice(payload.sale_price)
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Prix promo invalide (nombre positif, 2 décimales max, ou vide pour l'effacer).",
        },
        { status: 400 }
      );
    }
    if (payload.stock_quantity !== undefined) {
      const n = Number(payload.stock_quantity);
      if (!Number.isFinite(n) || n < 0) {
        return NextResponse.json(
          { success: false, message: "Quantité de stock invalide (nombre positif)." },
          { status: 400 }
        );
      }
      payload.stock_quantity = n;
    }
    if (Object.keys(payload).length === 0) {
      return NextResponse.json({ success: false, message: "Aucun champ modifiable fourni." }, { status: 400 });
    }

    const updated = await updateProduct(id, payload as ProductPatch);
    await recordAudit(session, "shop.product.update", `shop/produits/${id}`, { fields: Object.keys(payload) });
    return NextResponse.json(updated);
  } catch (error) {
    return shopErrorResponse(error, "PATCH /api/shop/produits/[id]");
  }
}
