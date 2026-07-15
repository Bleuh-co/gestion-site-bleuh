import { NextRequest, NextResponse } from "next/server";
import { requireSession, requireAdmin } from "@/lib/auth-server";
import type { Product } from "@/lib/types";

// GET /api/produits — Liste produits (query: status, category, search) [membre]
export async function GET(_req: NextRequest) {
  await requireSession();
  // TODO: implémenter — voir Antigravity.md
  const products: Product[] = [];
  return NextResponse.json(products);
}

// POST /api/produits — Créer produit [admin]
export async function POST(_req: NextRequest) {
  await requireAdmin();
  // TODO: implémenter — voir Antigravity.md
  return NextResponse.json({ success: true });
}
