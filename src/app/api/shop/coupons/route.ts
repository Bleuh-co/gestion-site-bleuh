import { NextRequest, NextResponse } from "next/server";
import { requireRead, requireWrite } from "@/lib/auth-server";
import { recordAudit } from "@/lib/audit";
import { listCoupons, createCoupon, shopErrorResponse } from "@/lib/shop-store";

export const runtime = "nodejs";

// GET /api/shop/coupons — liste des coupons (Firestore shop_coupons).
// Réponse : { items, total, totalPages }.
export async function GET(req: NextRequest) {
  try {
    await requireRead();
    const sp = req.nextUrl.searchParams;
    const result = await listCoupons({
      search: sp.get("search") || undefined,
      page: Number(sp.get("page")) || 1,
      perPage: Number(sp.get("per_page")) || 100,
    });
    return NextResponse.json(result);
  } catch (error) {
    return shopErrorResponse(error, "GET /api/shop/coupons");
  }
}

// POST /api/shop/coupons — crée un coupon (docId = code en minuscules).
// Champs en liste blanche stricte ; 409 si le code existe déjà.
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
    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum) || amountNum < 0) {
      return NextResponse.json({ success: false, message: "Montant du coupon invalide (nombre positif)." }, { status: 400 });
    }

    let usageLimit: number | null = null;
    if (src.usage_limit !== undefined && src.usage_limit !== null && String(src.usage_limit).trim() !== "") {
      const n = Number(src.usage_limit);
      if (!Number.isInteger(n) || n < 0) {
        return NextResponse.json({ success: false, message: "Limite d'utilisation invalide." }, { status: 400 });
      }
      usageLimit = n;
    }
    const emailRestrictions = Array.isArray(src.email_restrictions)
      ? src.email_restrictions.filter((e): e is string => typeof e === "string")
      : [];

    const created = await createCoupon({
      code,
      discount_type: discountType,
      amount: String(amount),
      usage_limit: usageLimit,
      email_restrictions: emailRestrictions,
    });

    await recordAudit(session, "shop.coupon.create", `shop/coupons/${created.code}`, {
      code: created.code,
      discount_type: discountType,
      amount: String(amount),
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return shopErrorResponse(error, "POST /api/shop/coupons");
  }
}
