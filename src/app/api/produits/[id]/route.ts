import { NextRequest, NextResponse } from "next/server";
import { requireRead, requireWrite } from "@/lib/auth-server";
import { recordAudit } from "@/lib/audit";
import {
  assertSkuUnique,
  docToProduct,
  handleError,
  productsCol,
  validateProductInput,
  ValidationError,
} from "@/lib/products-service";
import type { Product } from "@/lib/types";

// GET /api/produits/[id] — Détail produit
// Porté depuis GET /:id de routes/site-products.js.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireRead();
    const { id } = await ctx.params;

    const doc = await productsCol().doc(id).get();
    if (!doc.exists) {
      return NextResponse.json({ error: "Produit introuvable." }, { status: 404 });
    }
    return NextResponse.json(docToProduct(doc));
  } catch (error) {
    return handleError(error, "GET /api/produits/[id]");
  }
}

// PATCH /api/produits/[id] — Modifier produit
// Porté depuis PUT /:id de routes/site-products.js : merge existant+body,
// REVALIDE TOUT via validateProductInput (pas un update partiel Firestore —
// c'est ce que fait /archive), unicité SKU (exclut id), préserve createdAt,
// set() total du document.
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireWrite();
    const { id } = await ctx.params;

    const ref = productsCol().doc(id);
    const doc = await ref.get();
    if (!doc.exists) {
      return NextResponse.json({ error: "Produit introuvable." }, { status: 404 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      throw new ValidationError("Corps de requête JSON invalide.");
    }
    if (!body || typeof body !== "object") {
      throw new ValidationError("Corps de requête JSON invalide.");
    }

    const input = validateProductInput({ ...doc.data(), ...(body as Record<string, unknown>) });
    await assertSkuUnique(input.sku, id);

    const existingData = doc.data() as Partial<Product> | undefined;
    const now = new Date().toISOString();
    const toStore = {
      ...input,
      createdAt: existingData?.createdAt || now,
      updatedAt: now,
    };
    await ref.set(toStore);

    const product: Product = {
      ...toStore,
      id,
      rotationVarieties: toStore.rotationVarieties as Product["rotationVarieties"],
      relatedProducts: toStore.relatedProducts as Product["relatedProducts"],
    };

    await recordAudit(session, "product.update", `products/${id}`, {
      name: product.name,
      sku: product.sku,
    });

    return NextResponse.json(product);
  } catch (error) {
    return handleError(error, "PATCH /api/produits/[id]");
  }
}

// DELETE /api/produits/[id] — Suppression définitive (pas de soft delete)
// Porté depuis DELETE /:id de routes/site-products.js.
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireWrite();
    const { id } = await ctx.params;

    const ref = productsCol().doc(id);
    const doc = await ref.get();
    if (!doc.exists) {
      return NextResponse.json({ error: "Produit introuvable." }, { status: 404 });
    }
    const product = docToProduct(doc);
    await ref.delete();

    await recordAudit(session, "product.delete", `products/${id}`, {
      name: product.name,
      sku: product.sku,
    });

    return NextResponse.json({ status: "deleted", id });
  } catch (error) {
    return handleError(error, "DELETE /api/produits/[id]");
  }
}
