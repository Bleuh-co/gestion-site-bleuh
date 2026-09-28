import { NextRequest, NextResponse } from "next/server";
import { requireRead } from "@/lib/auth-server";
import { handleError } from "@/lib/products-service";
import { isStudioConfigured, listBleuhImages } from "@/lib/studio-chanv";

/**
 * GET /api/produits/studio/search?q=… — images Bleuh de la bibliothèque
 * Studio Chanv, pour réutiliser un visuel officiel au lieu d'en re-téléverser
 * un.
 *
 * SÉCURITÉ (le point qui bloquait le portage) : on n'expose pas Studio au
 * navigateur. L'appel part du serveur, la clé de service reste côté serveur, et
 * la réponse est réduite aux seules images de la marque Bleuh — jamais la
 * bibliothèque entière du groupe. `requireRead()` filtre les utilisateurs
 * non authentifiés en amont.
 */

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    await requireRead();

    if (!isStudioConfigured()) {
      // Le module reste utilisable sans Studio : le téléversement de fichier
      // fonctionne, seule la reprise d'un visuel existant est indisponible.
      return NextResponse.json(
        {
          assets: [],
          unavailable: true,
          message:
            "La bibliothèque Studio Chanv n'est pas branchée sur cet environnement. Le téléversement d'une image depuis l'ordinateur reste disponible.",
        },
        { status: 200 }
      );
    }

    const q = req.nextUrl.searchParams.get("q") || "";
    const assets = await listBleuhImages(q);
    return NextResponse.json({ assets });
  } catch (error) {
    return handleError(error, "GET /api/produits/studio/search");
  }
}
