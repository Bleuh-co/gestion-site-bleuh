import { NextRequest, NextResponse } from "next/server";
import { requireRead } from "@/lib/auth-server";
import { bleuhFetch, relayJson, outilsErrorResponse, TIMEOUTS } from "@/lib/bleuh-admin-proxy";

export const runtime = "nodejs";

// GET /api/outils/status — heartbeats des crons/syncs.
// Porté depuis GET /status de routes/operations.js (Formulaire DB-Products-Master).
export async function GET(_req: NextRequest) {
  try {
    await requireRead();
    const upstream = await bleuhFetch("/admin/status", {
      timeout: TIMEOUTS.status,
      cache: "no-store",
    });
    return await relayJson(upstream);
  } catch (error) {
    return outilsErrorResponse(error, "GET /api/outils/status");
  }
}
