import { NextRequest, NextResponse } from "next/server";
import { hasPubliciteIngestKey } from "@/lib/publicite-ingest";
import { handleError } from "@/lib/products-service";
import { buildAcquisition, parsePeriod } from "@/lib/acquisition-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/publicite/retailer-clicks?period=7|30|90 — les clics vers un
 * détaillant, par chemin, zone, campagne, création et produit (lot L5, plan
 * publicite-bdion). Pour Studio Chanv (lot L9, à construire), jamais pour un
 * navigateur : authentifié par X-Publicite-Ingest-Key, PAS par la session
 * humaine de /api/acquisition. Aucune donnée personnelle — mêmes totaux que
 * la section « Clics vers un détaillant » de Marketing Bleuh › Acquisition.
 */
export async function GET(req: NextRequest) {
  try {
    if (!hasPubliciteIngestKey(req)) {
      return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
    }
    const period = parsePeriod(new URL(req.url).searchParams.get("period"));
    const { retailerClicks, generatedAt, period: p } = await buildAcquisition(period);
    return NextResponse.json({ generatedAt, period: p, retailerClicks });
  } catch (error) {
    return handleError(error, "GET /api/publicite/retailer-clicks");
  }
}
