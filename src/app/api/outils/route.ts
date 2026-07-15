import { NextRequest, NextResponse } from "next/server";
import { requireSession, requireAdmin } from "@/lib/auth-server";
import type { Tool } from "@/lib/types";

// GET /api/outils — Liste outils actifs [membre]
export async function GET(_req: NextRequest) {
  await requireSession();
  // TODO: implémenter — voir Antigravity.md
  const tools: Tool[] = [];
  return NextResponse.json(tools);
}

// POST /api/outils — Créer outil [admin]
export async function POST(_req: NextRequest) {
  await requireAdmin();
  // TODO: implémenter — voir Antigravity.md
  return NextResponse.json({ success: true });
}
