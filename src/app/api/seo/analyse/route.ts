import { NextResponse } from "next/server";
import { requireWrite } from "@/lib/auth-server";
import { recordAudit } from "@/lib/audit";
import { handleError } from "@/lib/products-service";
import { adminDb } from "@/lib/firebase-admin";
import { runSeoAiAnalysis } from "@/lib/seo-analyzer";
import type { SeoReport } from "@/lib/seo-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/seo/analyse — synthèse IA de recommandations SEO priorisées à
// partir du dernier rapport stocké. Coûte des tokens (claude-sonnet-4-6) →
// requireWrite. Renvoie { summary, recommendations }. 409 si aucun rapport.
export async function POST() {
  try {
    const session = await requireWrite();

    const snap = await adminDb().collection("seo_reports").doc("latest").get();
    if (!snap.exists) {
      return NextResponse.json(
        { error: "Aucun rapport SEO. Lancez d'abord un scan.", code: "no_report" },
        { status: 409 }
      );
    }

    const report = snap.data() as SeoReport;
    const result = await runSeoAiAnalysis(report);

    await recordAudit(session, "seo.analyse.run", `seo/${report.baseUrl}`, {
      model: result.model,
      hasSummary: result.summary !== null,
      recommendations: result.recommendations.length,
    });

    return NextResponse.json(result);
  } catch (error) {
    return handleError(error, "POST /api/seo/analyse");
  }
}
