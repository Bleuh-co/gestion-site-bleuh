import { NextRequest } from "next/server";
import { requireWrite } from "@/lib/auth-server";
import { recordAudit } from "@/lib/audit";
import { wooFetch, relayWooJson, shopErrorResponse, TIMEOUTS } from "@/lib/woo-proxy";

export const runtime = "nodejs";

// ⚠️ ÉCRITURE RÉELLE sur bleuh.shop (PROD). DELETE /api/shop/coupons/[id] —
// supprime définitivement un coupon (force=true : pas de corbeille Woo).
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireWrite();
    const { id } = await ctx.params;

    const upstream = await wooFetch(`/coupons/${encodeURIComponent(id)}`, {
      method: "DELETE",
      searchParams: { force: true },
      timeout: TIMEOUTS.write,
    });

    if (upstream.ok) {
      await recordAudit(session, "shop.coupon.delete", `shop/coupons/${id}`, { id });
    }
    return await relayWooJson(upstream);
  } catch (error) {
    return shopErrorResponse(error, "DELETE /api/shop/coupons/[id]");
  }
}
