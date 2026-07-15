import { NextRequest, NextResponse } from "next/server";
import { requireSession, requireAdmin } from "@/lib/auth-server";
import type { Product } from "@/lib/types";

// GET /api/produits/[id] — Détail produit [membre]
export async function GET(_req: NextRequest, _ctx: { params: Promise<{ id: string }> }) {
  await requireSession();
  // TODO: implémenter — voir Antigravity.md
  const product: Product | null = null;
  return NextResponse.json(product);
}

// PATCH /api/produits/[id] — Modifier produit [admin]
export async function PATCH(_req: NextRequest, _ctx: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  // TODO: implémenter — voir Antigravity.md
  return NextResponse.json({ success: true });
}

// DELETE /api/produits/[id] — Supprimer produit [admin]
export async function DELETE(_req: NextRequest, _ctx: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  // TODO: implémenter — voir Antigravity.md
  return NextResponse.json({ success: true });
}
