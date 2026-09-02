import { NextRequest, NextResponse } from "next/server";
import { requireWrite } from "@/lib/auth-server";
import { handleError, ValidationError } from "@/lib/products-service";
import { saveProductImage } from "@/lib/product-images";
import { downloadStudioAsset } from "@/lib/studio-chanv";

/**
 * POST /api/produits/image-from-studio — reprend une image existante de la
 * bibliothèque Studio Chanv pour un produit.
 *
 * Corps JSON : { assetId, filename? }
 * Réponse    : { url } — comme POST /api/produits/image.
 *
 * L'image est RECOPIÉE dans le bucket public plutôt que liée à Studio : le
 * site public ne doit pas dépendre de l'endpoint de vignettes de Studio, qui
 * est fortement limité en débit (cf. lib/product-images.ts).
 */

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const session = await requireWrite();

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      throw new ValidationError("Corps JSON invalide.");
    }
    const payload = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
    const assetId = typeof payload.assetId === "string" ? payload.assetId.trim() : "";
    if (!assetId) {
      throw new ValidationError("Le champ « assetId » est requis.");
    }

    const asset = await downloadStudioAsset(assetId);

    const requested = typeof payload.filename === "string" ? payload.filename.trim() : "";
    const filename = requested || asset.filename || assetId;

    const stored = await saveProductImage({
      bytes: asset.bytes,
      filename,
      mimeType: asset.contentType,
    });

    console.log(
      `[produits/image-from-studio] asset ${assetId} → ${stored.filename} par ${session.email}`
    );

    return NextResponse.json({
      url: stored.url,
      path: stored.path,
      filename: stored.filename,
      studioAssetId: assetId,
    });
  } catch (error) {
    return handleError(error, "POST /api/produits/image-from-studio");
  }
}
