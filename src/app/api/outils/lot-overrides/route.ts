import { NextRequest, NextResponse } from "next/server";
import { requireRead, requireWrite } from "@/lib/auth-server";
import { recordAudit } from "@/lib/audit";
import { bleuhFetch, relayJson, outilsErrorResponse, TIMEOUTS } from "@/lib/bleuh-admin-proxy";

export const runtime = "nodejs";

// GET /api/outils/lot-overrides — liste des overrides de lots.
// Porté depuis GET /lot-overrides de routes/operations.js.
export async function GET(_req: NextRequest) {
  try {
    await requireRead();
    const upstream = await bleuhFetch("/admin/lot-overrides", {
      timeout: TIMEOUTS.overrides,
      cache: "no-store",
    });
    return await relayJson(upstream);
  } catch (error) {
    return outilsErrorResponse(error, "GET /api/outils/lot-overrides");
  }
}

// POST /api/outils/lot-overrides — création d'un override de lot.
// Porté depuis POST /lot-overrides de routes/operations.js.
// NB : audit ajouté au portage (absent de la source Express).
export async function POST(req: NextRequest) {
  try {
    const session = await requireWrite();

    let body: Record<string, unknown> = {};
    try {
      const parsed = await req.json();
      if (parsed && typeof parsed === "object") body = parsed as Record<string, unknown>;
    } catch {
      return NextResponse.json({ success: false, message: "Corps de requête JSON invalide." }, { status: 400 });
    }

    const upstream = await bleuhFetch("/admin/lot-overrides", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      timeout: TIMEOUTS.overrides,
    });

    if (upstream.ok) {
      await recordAudit(session, "outils.lotOverride.create", "outils/lot-overrides", {
        store: body.store,
        gtin: body.gtin,
      });
    }

    return await relayJson(upstream);
  } catch (error) {
    return outilsErrorResponse(error, "POST /api/outils/lot-overrides");
  }
}

// DELETE /api/outils/lot-overrides — suppression d'un override de lot.
// Porté depuis DELETE /lot-overrides de routes/operations.js.
// NB : audit ajouté au portage (absent de la source Express).
export async function DELETE(req: NextRequest) {
  try {
    const session = await requireWrite();

    let body: Record<string, unknown> = {};
    try {
      const parsed = await req.json();
      if (parsed && typeof parsed === "object") body = parsed as Record<string, unknown>;
    } catch {
      return NextResponse.json({ success: false, message: "Corps de requête JSON invalide." }, { status: 400 });
    }

    const upstream = await bleuhFetch("/admin/lot-overrides", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      timeout: TIMEOUTS.overrides,
    });

    if (upstream.ok) {
      await recordAudit(session, "outils.lotOverride.delete", "outils/lot-overrides", {
        store: body.store,
        gtin: body.gtin,
      });
    }

    return await relayJson(upstream);
  } catch (error) {
    return outilsErrorResponse(error, "DELETE /api/outils/lot-overrides");
  }
}
