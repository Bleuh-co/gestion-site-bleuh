import { NextRequest, NextResponse } from "next/server";
import { requireRead, requireWrite } from "@/lib/auth-server";
import type { Product } from "@/lib/types";

// GET /api/produits — Liste produits (query: status, category, search)
export async function GET(_req: NextRequest) {
  await requireRead();
  // TODO: implémenter — voir Antigravity.md
  const products: Product[] = [];
  return NextResponse.json(products);
}

// POST /api/produits — Créer produit
export async function POST(_req: NextRequest) {
  await requireWrite();
  // TODO: implémenter — voir Antigravity.md
  return NextResponse.json({ success: true });
}
