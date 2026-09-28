import { NextRequest } from "next/server";
import { requireWrite } from "@/lib/auth-server";
import { recordAudit } from "@/lib/audit";
import { bleuhFetch, relayJson, outilsErrorResponse, TIMEOUTS } from "@/lib/bleuh-admin-proxy";

export const runtime = "nodejs";
export const maxDuration = 300;

// POST /api/varietes/rebuild — reconstruit le référentiel depuis les lots.
//
// Full scan de wp_bleuh_lots côté BleuhAPI, d'où TIMEOUTS.sync et
// maxDuration : c'est du même ordre qu'une synchronisation, pas une lecture.
//
// Le tri fait à la main N'EST PAS écrasé : rebuild() ne réécrit que les
// colonnes dérivées des lots (nombre, dates, provinces). Les fusions, les
// exclusions et les notes sont absentes de son payload, par construction.
// Vérifié en production le 2026-08-31 : reconstruction des 171 lignes, les
// 25 fusions et 9 exclusions intactes après coup.
//
// Ce bouton reste utile parce que Cloud Run n'exécute pas les migrations et
// que la synchronisation des lots ne déclenche pas encore la reconstruction :
// sans lui, une variété nouvellement emballée n'apparaît pas dans la liste.
export async function POST(_req: NextRequest) {
  try {
    const session = await requireWrite();

    const upstream = await bleuhFetch("/admin/varieties/rebuild", {
      method: "POST",
      headers: { Accept: "application/json" },
      timeout: TIMEOUTS.sync,
    });

    if (upstream.ok) {
      await recordAudit(session, "varietes.rebuild", "varietes/rebuild");
    }

    return await relayJson(upstream);
  } catch (error) {
    return outilsErrorResponse(error, "POST /api/varietes/rebuild");
  }
}
