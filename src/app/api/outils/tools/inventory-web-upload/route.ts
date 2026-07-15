import { NextRequest } from "next/server";
import { requireWrite } from "@/lib/auth-server";
import { recordAudit } from "@/lib/audit";
import { bleuhFetch, relayJson, outilsErrorResponse, TIMEOUTS } from "@/lib/bleuh-admin-proxy";

export const runtime = "nodejs";
export const maxDuration = 300;

// POST /api/outils/tools/inventory-web-upload — CSV inventaire Web de secours.
// Porté depuis POST /tools/inventory-web-upload de routes/operations.js.
// Multipart relayé tel quel (pas de FormData/multer) ; Accept: application/json
// obligatoire côté BleuhAPI (sinon 302 au lieu de 422 — voir brief piège 7).
// NB : audit ajouté au portage (absent de la source Express).
export async function POST(req: NextRequest) {
  try {
    const session = await requireWrite();
    const contentType = req.headers.get("content-type") || "multipart/form-data";

    const upstream = await bleuhFetch("/admin/tools/inventory-web-upload", {
      method: "POST",
      headers: { "Content-Type": contentType, Accept: "application/json" },
      body: req.body,
      duplex: "half",
      timeout: TIMEOUTS.upload,
    });

    if (upstream.ok) {
      await recordAudit(session, "outils.inventoryWebUpload", "outils/tools/inventory-web-upload", {});
    }

    return await relayJson(upstream);
  } catch (error) {
    return outilsErrorResponse(error, "POST /api/outils/tools/inventory-web-upload");
  }
}
