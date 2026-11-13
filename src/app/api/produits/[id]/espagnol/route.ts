import { NextRequest, NextResponse } from "next/server";
import { requireRead, requireWrite } from "@/lib/auth-server";
import { recordAudit } from "@/lib/audit";
import { handleError, productsCol, ValidationError } from "@/lib/products-service";
import { ecrireEspagnol, lireEspagnol } from "@/lib/products-es-service";
import { champsPerimes, textesDeLaFiche, validerTextesEs, type FicheSource } from "@/lib/products-es-pure";

// Section espagnole d'une fiche produit — collection `products_es`, à part de
// `products` (le pourquoi : lib/products-es-pure.ts).

// GET /api/produits/[id]/espagnol → { espagnol | null, anglais, perimes }
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireRead();
    const { id } = await ctx.params;
    const doc = await productsCol().doc(id).get();
    if (!doc.exists) return NextResponse.json({ error: "Produit introuvable." }, { status: 404 });
    const anglais = textesDeLaFiche(doc.data() as FicheSource, "en");
    const espagnol = await lireEspagnol(id);
    return NextResponse.json({ espagnol, anglais, perimes: champsPerimes(espagnol, anglais) });
  } catch (error) {
    return handleError(error, "GET /api/produits/[id]/espagnol");
  }
}

// PUT /api/produits/[id]/espagnol — enregistre la section. Corps :
// { textes, mode } ; l'anglais du moment est mémorisé comme source.
export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireWrite();
    const { id } = await ctx.params;
    const doc = await productsCol().doc(id).get();
    if (!doc.exists) return NextResponse.json({ error: "Produit introuvable." }, { status: 404 });

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      throw new ValidationError("Corps de requête JSON invalide.");
    }
    const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
    const v = validerTextesEs(b.textes);
    if (!v.ok) throw new ValidationError(v.error);

    const anglais = textesDeLaFiche(doc.data() as FicheSource, "en");
    const espagnol = await ecrireEspagnol(id, v.value, anglais, b.mode === "auto" ? "auto" : "manuel", session.email ?? null);
    await recordAudit(session, "product.es.update", `products_es/${id}`, { name: espagnol.name, mode: espagnol.mode });
    return NextResponse.json({ espagnol, anglais, perimes: champsPerimes(espagnol, anglais) });
  } catch (error) {
    return handleError(error, "PUT /api/produits/[id]/espagnol");
  }
}
