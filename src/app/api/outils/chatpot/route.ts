import { NextRequest, NextResponse } from "next/server";
import { requireWrite } from "@/lib/auth-server";
import { recordAudit } from "@/lib/audit";
import { bleuhFetch, binaryHeaders, relayJson, outilsErrorResponse, TIMEOUTS } from "@/lib/bleuh-admin-proxy";

export const runtime = "nodejs";
export const maxDuration = 300;

// POST /api/outils/chatpot — upload XLSX (multipart) → download PDF.
// Porté depuis POST /chatpot de routes/operations.js. Cumule upload
// multipart en entrée et download binaire en sortie (brief §3).
// NB : audit ajouté au portage (absent de la source Express).
export async function POST(req: NextRequest) {
  try {
    const session = await requireWrite();
    const contentType = req.headers.get("content-type") || "multipart/form-data";

    const upstream = await bleuhFetch("/admin/chatpot", {
      method: "POST",
      headers: { "Content-Type": contentType, Accept: "application/json" },
      body: req.body,
      duplex: "half",
      timeout: TIMEOUTS.upload,
    });

    if (!upstream.ok) {
      return await relayJson(upstream);
    }

    await recordAudit(session, "outils.chatpot", "outils/chatpot", {});

    return new NextResponse(upstream.body, { status: upstream.status, headers: binaryHeaders(upstream) });
  } catch (error) {
    return outilsErrorResponse(error, "POST /api/outils/chatpot");
  }
}
