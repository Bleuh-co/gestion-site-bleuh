import { NextRequest, NextResponse } from "next/server";
import { requireWrite } from "@/lib/auth-server";
import { recordAudit } from "@/lib/audit";
import { handleError } from "@/lib/products-service";
import { normalizePeriod, runDeepCeoAnalysis } from "@/lib/ceo-analysis-service";

// POST /api/analyse-ceo/run?period=7d|30d|90d — Analyse approfondie déclenchée
// manuellement (bouton « Lancer une vraie analyse »). Coûte des tokens
// (claude-sonnet-4-6, prompt plus riche) → requireWrite (gestionnaire et
// plus), pas requireRead, même si ce module ne fait pas d'écriture Firestore.
export async function POST(req: NextRequest) {
  try {
    const session = await requireWrite();
    const { searchParams } = new URL(req.url);
    const period = normalizePeriod(searchParams.get("period"));

    const result = await runDeepCeoAnalysis(period);

    await recordAudit(session, "ceo.analysis.run", `analyse-ceo/${period}`, {
      model: result.model,
      period,
      hasInsights: result.insights !== null,
    });

    return NextResponse.json(result);
  } catch (error) {
    return handleError(error, "POST /api/analyse-ceo/run");
  }
}
