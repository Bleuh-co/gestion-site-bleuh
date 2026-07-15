import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";

// PATCH /api/outils/[id] — Modifier outil [admin]
export async function PATCH(_req: NextRequest, _ctx: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  // TODO: implémenter — voir Antigravity.md
  return NextResponse.json({ success: true });
}

// DELETE /api/outils/[id] — Supprimer outil [admin]
export async function DELETE(_req: NextRequest, _ctx: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  // TODO: implémenter — voir Antigravity.md
  return NextResponse.json({ success: true });
}
