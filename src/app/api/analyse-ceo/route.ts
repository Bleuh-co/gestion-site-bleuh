import { NextRequest, NextResponse } from "next/server";
import { requireRead } from "@/lib/auth-server";
import { handleError } from "@/lib/products-service";
import { buildCeoAnalysis, normalizePeriod } from "@/lib/ceo-analysis-service";

// GET /api/analyse-ceo?period=7d|30d|90d — KPIs réels du bot Bleuh
// (chat_usage/chat_sessions) + synthèse IA optionnelle. Lecture pour tout
// rôle authentifié (requireRead) — aucune écriture dans ce module.
export async function GET(req: NextRequest) {
  try {
    await requireRead();
    const { searchParams } = new URL(req.url);
    const period = normalizePeriod(searchParams.get("period"));
    const result = await buildCeoAnalysis(period);
    return NextResponse.json(result);
  } catch (error) {
    return handleError(error, "GET /api/analyse-ceo");
  }
}
