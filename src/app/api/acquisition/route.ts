import { NextRequest, NextResponse } from "next/server";
import { requireRead } from "@/lib/auth-server";
import { handleError } from "@/lib/products-service";
import { buildAcquisition, parsePeriod } from "@/lib/acquisition-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/acquisition?period=7|30|90 — provenance des visites de bleuh.co,
 * clics sortants vers les détaillants, et temps passé par page. Lecture pour
 * tout rôle authentifié (requireRead) : ce module n'écrit rien.
 */
export async function GET(req: NextRequest) {
  try {
    await requireRead();
    const { searchParams } = new URL(req.url);
    const period = parsePeriod(searchParams.get("period"));
    return NextResponse.json(await buildAcquisition(period));
  } catch (error) {
    return handleError(error, "GET /api/acquisition");
  }
}
