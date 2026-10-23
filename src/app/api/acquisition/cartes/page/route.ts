import { NextRequest, NextResponse } from "next/server";
import { requireRead } from "@/lib/auth-server";
import { handleError } from "@/lib/products-service";
import { lastNDaysUtc } from "@/lib/acquisition-pure";
import { parsePeriod } from "@/lib/acquisition-service";
import { estAppareil, estVariante } from "@/lib/cartes-clics-pure";
import { lireCarte } from "@/lib/cartes-clics-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/acquisition/cartes/page?page=/chemin&appareil=…&variante=qc|ca&period=7|30|90
 * — la carte d'une page de bleuh.co pour un type d'écran et une variante,
 * jours de la période fusionnés.
 */
export async function GET(req: NextRequest) {
  try {
    await requireRead();
    const { searchParams } = new URL(req.url);
    const page = searchParams.get("page") ?? "";
    const appareil = searchParams.get("appareil");
    const variante = searchParams.get("variante");
    if (!page.startsWith("/") || page.length > 120 || !estAppareil(appareil) || !estVariante(variante)) {
      return NextResponse.json({ error: "Paramètres invalides.", code: "validation_error" }, { status: 400 });
    }
    const days = lastNDaysUtc(parsePeriod(searchParams.get("period")));
    return NextResponse.json(await lireCarte(days, appareil, variante, page));
  } catch (error) {
    return handleError(error, "GET /api/acquisition/cartes/page");
  }
}
