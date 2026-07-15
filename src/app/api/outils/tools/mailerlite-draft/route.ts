import { NextRequest } from "next/server";
import { requireWrite } from "@/lib/auth-server";
import { recordAudit } from "@/lib/audit";
import { bleuhFetch, relayJson, outilsErrorResponse, TIMEOUTS } from "@/lib/bleuh-admin-proxy";

export const runtime = "nodejs";
export const maxDuration = 300;

// POST /api/outils/tools/mailerlite-draft[?dry=1] — brouillon MailerLite.
// Porté depuis POST /tools/mailerlite-draft de routes/operations.js.
// NB : audit ajouté au portage même en dry-run (préconisation du brief) —
// `dry: true` dans les détails permet de distinguer prévisualisation/création.
export async function POST(req: NextRequest) {
  try {
    const session = await requireWrite();
    const dry = req.nextUrl.searchParams.get("dry");
    const qs = dry ? "?dry=1" : "";

    const upstream = await bleuhFetch(`/admin/tools/mailerlite-draft${qs}`, {
      method: "POST",
      headers: { Accept: "application/json" },
      timeout: TIMEOUTS.tool,
    });

    if (upstream.ok) {
      await recordAudit(session, "outils.mailerliteDraft", "outils/tools/mailerlite-draft", { dry: Boolean(dry) });
    }

    return await relayJson(upstream);
  } catch (error) {
    return outilsErrorResponse(error, "POST /api/outils/tools/mailerlite-draft");
  }
}
