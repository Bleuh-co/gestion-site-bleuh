import { NextRequest, NextResponse } from "next/server";
import { requireWrite } from "@/lib/auth-server";

// PATCH /api/outils/[id] — Modifier outil
export async function PATCH(_req: NextRequest, _ctx: { params: Promise<{ id: string }> }) {
  await requireWrite();
  // TODO: implémenter — voir Antigravity.md
  return NextResponse.json({ success: true });
}

// DELETE /api/outils/[id] — Supprimer outil
export async function DELETE(_req: NextRequest, _ctx: { params: Promise<{ id: string }> }) {
  await requireWrite();
  // TODO: implémenter — voir Antigravity.md
  return NextResponse.json({ success: true });
}
