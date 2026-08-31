import { NextRequest, NextResponse } from "next/server";
import { requireWrite } from "@/lib/auth-server";
import { recordAudit } from "@/lib/audit";
import { bleuhFetch, relayJson, outilsErrorResponse, TIMEOUTS } from "@/lib/bleuh-admin-proxy";
import { parseVarietyId, validateCurationPatch, VarietyValidationError } from "@/lib/varieties-service";

export const runtime = "nodejs";

// PATCH /api/varietes/:id — tri du référentiel (fusion, exclusion, note).
//
// Il n'y a volontairement ni POST ni DELETE : on ne crée pas une variété et
// on n'en supprime pas. Les lignes viennent des lots réels de l'ERP et sont
// reconstruites par BleuhAPI ; tout ce qu'un humain peut faire, c'est dire
// « celle-ci est la même que celle-là » ou « celle-ci n'est pas une variété ».
//
// BleuhAPI revalide tout et reste seul juge : il refuse les auto-fusions, les
// cycles, l'exclusion d'une ligne qui absorbe des orthographes et les motifs
// hors liste. On ne duplique pas ces règles ici, on relaie son code HTTP.
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireWrite();
    const { id } = await ctx.params;
    const varietyId = parseVarietyId(id);

    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return NextResponse.json({ success: false, message: "Corps de requête JSON invalide." }, { status: 400 });
    }

    const patch = validateCurationPatch(raw);

    const upstream = await bleuhFetch(`/admin/varieties/${varietyId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(patch),
      timeout: TIMEOUTS.overrides,
    });

    // Audit seulement après confirmation upstream : un 422 refusé par
    // BleuhAPI n'a rien modifié, le journaliser laisserait croire l'inverse.
    if (upstream.ok) {
      await recordAudit(session, "varietes.curation", `varietes/${varietyId}`, { ...patch });
    }

    return await relayJson(upstream);
  } catch (error) {
    if (error instanceof VarietyValidationError) {
      return NextResponse.json({ success: false, message: error.message }, { status: 400 });
    }
    return outilsErrorResponse(error, "PATCH /api/varietes/:id");
  }
}
