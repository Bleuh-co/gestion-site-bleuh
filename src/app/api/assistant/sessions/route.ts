import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-server";
import type { ChatSession } from "@/lib/types";

// GET /api/assistant/sessions — Liste des sessions de chat de l'utilisateur [membre]
export async function GET(_req: NextRequest) {
  await requireSession();
  // TODO: implémenter — voir Antigravity.md
  const sessions: ChatSession[] = [];
  return NextResponse.json(sessions);
}
