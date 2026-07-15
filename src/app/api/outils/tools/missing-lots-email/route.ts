import { NextRequest } from "next/server";
import { requireWrite } from "@/lib/auth-server";
import { recordAudit } from "@/lib/audit";
import { bleuhFetch, relayJson, outilsErrorResponse, TIMEOUTS } from "@/lib/bleuh-admin-proxy";

export const runtime = "nodejs";
export const maxDuration = 300;

// POST /api/outils/tools/missing-lots-email — envoie le courriel "contenu manquant".
// Porté depuis POST /tools/missing-lots-email de routes/operations.js.
// Effet réel : envoie un vrai courriel — confirmation navigateur requise côté UI.
// NB : audit ajouté au portage (absent de la source Express).
export async function POST(_req: NextRequest) {
  try {
    const session = await requireWrite();

    const upstream = await bleuhFetch("/admin/tools/missing-lots-email", {
      method: "POST",
      headers: { Accept: "application/json" },
      timeout: TIMEOUTS.tool,
    });

    if (upstream.ok) {
      await recordAudit(session, "outils.missingLotsEmail", "outils/tools/missing-lots-email", {});
    }

    return await relayJson(upstream);
  } catch (error) {
    return outilsErrorResponse(error, "POST /api/outils/tools/missing-lots-email");
  }
}
