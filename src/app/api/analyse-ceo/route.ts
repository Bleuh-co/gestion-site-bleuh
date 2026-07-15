import { NextRequest, NextResponse } from "next/server";
import { requireRead } from "@/lib/auth-server";
import type { CeoAnalysis } from "@/lib/types";

// GET /api/analyse-ceo — Récupérer/générer l'analyse CEO (query: period)
export async function GET(_req: NextRequest) {
  await requireRead();
  // TODO: implémenter — génération via @anthropic-ai/sdk — voir Antigravity.md
  const analysis: CeoAnalysis | null = null;
  return NextResponse.json(analysis);
}
