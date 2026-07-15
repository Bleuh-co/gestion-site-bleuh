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

// GET /api/produits — Liste produits (query: collection, province, status, q)
// Porté depuis GET / de routes/site-products.js : lit toute la collection,
// filtre en mémoire, trie par name.fr.
export async function GET(req: NextRequest) {
  try {
    await requireRead();

    const { searchParams } = new URL(req.url);
    const collection = searchParams.get("collection");
    const province = searchParams.get("province");
    const status = searchParams.get("status");
    const q = searchParams.get("q");

    const snap = await productsCol().get();
    let products: Product[] = snap.docs.map(docToProduct);

    if (collection) products = products.filter((p) => p.collection === collection);
    if (province) products = products.filter((p) => (p.provinces || []).includes(province as Product["provinces"][number]));
    if (status) products = products.filter((p) => p.status === status);
    if (q) {
      const needle = q.toLowerCase();
      products = products.filter((p) =>
        [p.name?.fr, p.name?.en, p.slug?.fr, p.slug?.en, p.collection, p.gtin, p.sku]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(needle))
      );
    }

    products.sort((a, b) => (a.name?.fr || "").localeCompare(b.name?.fr || "", "fr"));

    return NextResponse.json(products);
  } catch (error) {
    return handleError(error, "GET /api/produits");
  }
}

// POST /api/produits — Créer produit (id de doc = slug.fr, refuse les doublons)
// Porté depuis POST / de routes/site-products.js.
export async function POST(req: NextRequest) {
  try {
    const session = await requireWrite();

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      throw new ValidationError("Corps de requête JSON invalide.");
    }

    const input = validateProductInput(body);
    await assertSkuUnique(input.sku);
    const id = input.slug.fr;
    const ref = productsCol().doc(id);
    const existing = await ref.get();
    if (existing.exists) {
      throw new ValidationError(`Un produit avec le slug « ${id} » existe déjà.`);
    }

    const now = new Date().toISOString();
    const product: Product = {
      ...input,
      id,
      createdAt: now,
      updatedAt: now,
      rotationVarieties: input.rotationVarieties as Product["rotationVarieties"],
      relatedProducts: input.relatedProducts as Product["relatedProducts"],
    };
    await ref.set({ ...input, createdAt: now, updatedAt: now });

    await recordAudit(session, "product.create", `products/${id}`, {
      name: product.name,
      sku: product.sku,
    });

    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    return handleError(error, "POST /api/produits");
  }
}
