import { NextRequest, NextResponse } from "next/server";
import { requireRead } from "@/lib/auth-server";
import type { ChatSession } from "@/lib/types";

// GET /api/assistant/sessions — Liste des sessions de chat de l'utilisateur
export async function GET(_req: NextRequest) {
  await requireRead();
  // TODO: implémenter — voir Antigravity.md
  const sessions: ChatSession[] = [];
  return NextResponse.json(sessions);
}
