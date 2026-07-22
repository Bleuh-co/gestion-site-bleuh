import { NextRequest, NextResponse } from "next/server";
import { requireRead, requireWrite } from "@/lib/auth-server";
import { recordAudit } from "@/lib/audit";
import { wooFetch, relayWooJson, shopErrorResponse, TIMEOUTS } from "@/lib/woo-proxy";

export const runtime = "nodejs";

// GET /api/shop/coupons — liste des coupons Woo (lecture seule).
export async function GET(req: NextRequest) {
  try {
    await requireRead();
    const sp = req.nextUrl.searchParams;
    const perPage = Math.min(Number(sp.get("per_page")) || 100, 100);
    const upstream = await wooFetch("/coupons", {
      searchParams: {
        search: sp.get("search") || undefined,
        page: sp.get("page") || undefined,
        per_page: perPage,
      },
      timeout: TIMEOUTS.read,
    });
    return await relayWooJson(upstream);
  } catch (error) {
    return shopErrorResponse(error, "GET /api/shop/coupons");
  }
}

// ⚠️ ÉCRITURE RÉELLE sur bleuh.shop (PROD). POST /api/shop/coupons —
// crée un coupon. Champs en liste blanche stricte.
export async function POST(req: NextRequest) {
  try {
    const session = await requireWrite();

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

    const code = typeof src.code === "string" ? src.code.trim() : "";
    if (!code) {
      return NextResponse.json({ success: false, message: "Le code du coupon est requis." }, { status: 400 });
    }
    const discountType = src.discount_type;
    if (discountType !== "percent" && discountType !== "fixed_cart") {
      return NextResponse.json({ success: false, message: "Type de rabais invalide (percent|fixed_cart)." }, { status: 400 });
    }
    const amount = src.amount;
    if (amount === undefined || amount === null || String(amount).trim() === "") {
      return NextResponse.json({ success: false, message: "Le montant du coupon est requis." }, { status: 400 });
    }

    const payload: Record<string, unknown> = {
      code,
      discount_type: discountType,
      amount: String(amount),
    };
    if (src.usage_limit !== undefined && src.usage_limit !== null && String(src.usage_limit).trim() !== "") {
      payload.usage_limit = Number(src.usage_limit);
    }
    if (Array.isArray(src.email_restrictions)) {
      payload.email_restrictions = src.email_restrictions.filter((e) => typeof e === "string");
    }

    const upstream = await wooFetch("/coupons", {
      method: "POST",
      body: payload,
      timeout: TIMEOUTS.write,
    });

    if (upstream.ok) {
      await recordAudit(session, "shop.coupon.create", `shop/coupons/${code}`, {
        code,
        discount_type: discountType,
        amount: String(amount),
      });
    }
    return await relayWooJson(upstream);
  } catch (error) {
    return shopErrorResponse(error, "POST /api/shop/coupons");
  }
}
