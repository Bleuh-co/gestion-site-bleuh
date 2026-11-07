import { NextRequest, NextResponse } from "next/server";
import { hasPubliciteIngestKey } from "@/lib/publicite-ingest";
import { handleError } from "@/lib/products-service";
import { buildAcquisition, buildAcquisitionRange, parsePeriod } from "@/lib/acquisition-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/publicite/retailer-clicks?period=7|30|90, ou ?du=AAAA-MM-JJ&au=AAAA-MM-JJ
 * (plage libre, jours UTC — lot L9) — les clics vers un détaillant, par
 * chemin, zone, campagne, création et produit (lot L5, plan publicite-bdion).
 * Pour Studio Chanv, jamais pour un navigateur : authentifié par
 * X-Publicite-Ingest-Key, PAS par la session humaine de /api/acquisition.
 * Aucune donnée personnelle — mêmes totaux que la section « Clics vers un
 * détaillant » de Marketing Bleuh › Acquisition.
 *
 * `du`/`au`, quand présents, l'emportent sur `period` : l'onglet Chiffres de
 * Studio propose « Hier » et une période libre, que `period` (7/30/90 jours
 * seulement) ne couvre pas. Une plage invalide répond 400, jamais 30 jours
 * à la place — même esprit que /api/ventes de marketing-mdh.
 */
export async function GET(req: NextRequest) {
  try {
    if (!hasPubliciteIngestKey(req)) {
      return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
    }
    const sp = new URL(req.url).searchParams;
    const du = sp.get("du");
    const au = sp.get("au");

    let resultat;
    if (du || au) {
      resultat = du && au ? await buildAcquisitionRange(du, au) : null;
      if (!resultat) {
        return NextResponse.json({ error: "Dates invalides : du et au, format AAAA-MM-JJ, du ≤ au, au pas dans le futur." }, { status: 400 });
      }
    } else {
      resultat = await buildAcquisition(parsePeriod(sp.get("period")));
    }

    const { retailerClicks, generatedAt, period: p } = resultat;
    return NextResponse.json({ generatedAt, period: p, retailerClicks });
  } catch (error) {
    return handleError(error, "GET /api/publicite/retailer-clicks");
  }
}
