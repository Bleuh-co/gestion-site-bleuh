import { NextRequest } from "next/server";
import { requireRead } from "@/lib/auth-server";
import { bleuhFetch, relayJson, outilsErrorResponse, TIMEOUTS } from "@/lib/bleuh-admin-proxy";
import { buildVarietiesQuery } from "@/lib/varieties-service";

export const runtime = "nodejs";

// GET /api/varietes — référentiel des variétés (BleuhAPI /admin/varieties).
//
// Paramètres relayés (liste blanche, cf. buildVarietiesQuery) :
//   ?q=        recherche sur le nom, les orthographes absorbées et la clé
//   ?active=1  seulement les variétés encore emballées
//   ?since=    dernier lot >= "AAAA-MM"
//   ?curation=1  inclut les lignes fusionnées/exclues + le résumé du tri
//
// Sans ?curation=1, la réponse est le VOCABULAIRE : ce que le sélecteur doit
// proposer. Les orthographes fusionnées et les rebuts en sont absents.
export async function GET(req: NextRequest) {
  try {
    await requireRead();
    const query = buildVarietiesQuery(req.nextUrl.searchParams);
    const upstream = await bleuhFetch(`/admin/varieties${query}`, {
      timeout: TIMEOUTS.status,
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    return await relayJson(upstream);
  } catch (error) {
    return outilsErrorResponse(error, "GET /api/varietes");
  }
}
