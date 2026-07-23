import { NextRequest, NextResponse } from "next/server";
import { requireWrite } from "@/lib/auth-server";
import { recordAudit } from "@/lib/audit";
import { deleteCoupon, shopErrorResponse } from "@/lib/shop-store";

export const runtime = "nodejs";

// DELETE /api/shop/coupons/[id] — supprime définitivement un coupon
// (Firestore shop_coupons, [id] = code du coupon, insensible à la casse).
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireWrite();
    const { id } = await ctx.params;

    const deleted = await deleteCoupon(id);
    await recordAudit(session, "shop.coupon.delete", `shop/coupons/${deleted.code}`, { code: deleted.code });
    return NextResponse.json(deleted);
  } catch (error) {
    return shopErrorResponse(error, "DELETE /api/shop/coupons/[id]");
  }
}
