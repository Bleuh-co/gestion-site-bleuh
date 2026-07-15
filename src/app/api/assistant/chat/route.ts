import { NextRequest, NextResponse } from "next/server";
import { requireWrite } from "@/lib/auth-server";

// POST /api/assistant/chat — Envoyer message à l'assistant IA
export async function POST(_req: NextRequest) {
  await requireWrite();
  // TODO: implémenter — appels @anthropic-ai/sdk — voir Antigravity.md
  return NextResponse.json({ success: true });
}
