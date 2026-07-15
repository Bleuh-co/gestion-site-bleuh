import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-server";

// POST /api/assistant/chat — Envoyer message à l'assistant IA [membre]
export async function POST(_req: NextRequest) {
  await requireSession();
  // TODO: implémenter — appels @anthropic-ai/sdk — voir Antigravity.md
  return NextResponse.json({ success: true });
}
