import { NextRequest } from "next/server";
import { requireWrite } from "@/lib/auth-server";
import { recordAudit } from "@/lib/audit";
import { bleuhFetch, relayJson, outilsErrorResponse, TIMEOUTS } from "@/lib/bleuh-admin-proxy";

export const runtime = "nodejs";
export const maxDuration = 300;

// POST /api/outils/tools/geocode-ontario[?reset=1] — géocodage des adresses ON.
// Porté depuis POST /tools/geocode-ontario de routes/operations.js.
// NB : audit ajouté au portage (absent de la source Express).
export async function POST(req: NextRequest) {
  try {
    const session = await requireWrite();
    const reset = req.nextUrl.searchParams.get("reset");
    const qs = reset ? "?reset=1" : "";

    const upstream = await bleuhFetch(`/admin/tools/geocode-ontario${qs}`, {
      method: "POST",
      headers: { Accept: "application/json" },
      timeout: TIMEOUTS.tool,
    });

    if (upstream.ok) {
      await recordAudit(session, "outils.geocodeOntario", "outils/tools/geocode-ontario", { reset: Boolean(reset) });
    }

    return await relayJson(upstream);
  } catch (error) {
    return outilsErrorResponse(error, "POST /api/outils/tools/geocode-ontario");
  }
}
