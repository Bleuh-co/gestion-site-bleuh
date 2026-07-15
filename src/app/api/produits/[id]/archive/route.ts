import { NextRequest, NextResponse } from "next/server";
import { requireWrite } from "@/lib/auth-server";
import { recordAudit } from "@/lib/audit";
import { docToProduct, handleError, productsCol } from "@/lib/products-service";

// POST /api/produits/[id]/archive — Archivage (soft delete : status → archived)
// Porté depuis POST /:id/archive de routes/site-products.js. Update PARTIEL
// Firestore (contrairement à PATCH qui fait un set() total) : ne touche que
// status + updatedAt.
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireWrite();
    const { id } = await ctx.params;

    const ref = productsCol().doc(id);
    const doc = await ref.get();
    if (!doc.exists) {
      return NextResponse.json({ error: "Produit introuvable." }, { status: 404 });
    }

    const updatedAt = new Date().toISOString();
    await ref.update({ status: "archived", updatedAt });

    const product = docToProduct(doc);
    await recordAudit(session, "product.archive", `products/${id}`, {
      name: product.name,
      sku: product.sku,
    });

    return NextResponse.json({ status: "archived", id });
  } catch (error) {
    return handleError(error, "POST /api/produits/[id]/archive");
  }
}
