import { NextRequest, NextResponse } from "next/server";
import { requireRead, requireWrite } from "@/lib/auth-server";
import type { Tool } from "@/lib/types";

// GET /api/outils — Liste outils actifs
export async function GET(_req: NextRequest) {
  await requireRead();
  // TODO: implémenter — voir Antigravity.md
  const tools: Tool[] = [];
  return NextResponse.json(tools);
}

// POST /api/outils — Créer outil
export async function POST(_req: NextRequest) {
  await requireWrite();
  // TODO: implémenter — voir Antigravity.md
  return NextResponse.json({ success: true });
}
