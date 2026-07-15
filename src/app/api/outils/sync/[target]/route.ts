import { NextRequest, NextResponse } from "next/server";
import { requireWrite } from "@/lib/auth-server";
import { recordAudit } from "@/lib/audit";
import { bleuhFetch, relayJson, outilsErrorResponse, SYNC_TARGETS, TIMEOUTS } from "@/lib/bleuh-admin-proxy";

export const runtime = "nodejs";
export const maxDuration = 300;

// POST /api/outils/sync/:target — synchronisations (peuvent dépasser 1 min).
// Porté depuis POST /sync/:target de routes/operations.js.
// NB : audit ajouté au portage (absent de la source Express, pur proxy) —
// uniquement après confirmation de succès upstream.
export async function POST(_req: NextRequest, ctx: { params: Promise<{ target: string }> }) {
  try {
    const session = await requireWrite();
    const { target } = await ctx.params;

    if (!SYNC_TARGETS.includes(target as (typeof SYNC_TARGETS)[number])) {
      return NextResponse.json({ success: false, message: `Cible de sync inconnue : ${target}.` }, { status: 400 });
    }

    const upstream = await bleuhFetch(`/admin/sync/${target}`, {
      method: "POST",
      headers: { Accept: "application/json" },
      timeout: TIMEOUTS.sync,
    });

    if (upstream.ok) {
      await recordAudit(session, "outils.sync", `outils/sync/${target}`, { target });
    }

    return await relayJson(upstream);
  } catch (error) {
    return outilsErrorResponse(error, "POST /api/outils/sync/[target]");
  }
}
