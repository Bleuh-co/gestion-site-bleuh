import { NextRequest, NextResponse } from "next/server";
import { requireRead } from "@/lib/auth-server";
import { handleError } from "@/lib/products-service";
import { isStudioConfigured, listBleuhImages } from "@/lib/studio-chanv";

/**
 * GET /api/produits/studio/search?q=…&cursor=…&page=… — images Bleuh de la
 * bibliothèque Studio Chanv, pour réutiliser un visuel officiel au lieu d'en
 * re-téléverser un.
 *
 * SÉCURITÉ (le point qui bloquait le portage) : on n'expose pas Studio au
 * navigateur. L'appel part du serveur, la clé de service reste côté serveur, et
 * la réponse est réduite aux seules images de la marque Bleuh — jamais la
 * bibliothèque entière du groupe. `requireRead()` filtre les utilisateurs
 * non authentifiés en amont.
 *
 * Pagination : `cursor` continue un PARCOURS (pas de `q`), `page` continue
 * une RECHERCHE (`q` posé) — jamais les deux à la fois, cf. la docstring de
 * `listBleuhImages`. Le client (ProductForm.tsx) ne connaît que ce qu'il a
 * reçu à la page précédente (`nextCursor`/`page`), il ne devine rien.
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
    const cursor = req.nextUrl.searchParams.get("cursor") || null;
    const pageParam = req.nextUrl.searchParams.get("page");
    const page = pageParam ? Math.max(1, parseInt(pageParam, 10) || 1) : 1;

    const result = await listBleuhImages({ query: q, cursor, page });
    return NextResponse.json({
      assets: result.assets,
      hasMore: result.hasMore,
      nextCursor: result.nextCursor,
      page: result.page,
    });
  } catch (error) {
    return handleError(error, "GET /api/produits/studio/search");
  }
}
