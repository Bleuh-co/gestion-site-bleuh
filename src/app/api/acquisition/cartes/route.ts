import { NextRequest, NextResponse } from "next/server";
import { requireRead } from "@/lib/auth-server";
import { handleError } from "@/lib/products-service";
import { lastNDaysUtc } from "@/lib/acquisition-pure";
import { parsePeriod } from "@/lib/acquisition-service";
import { lireListeCartes } from "@/lib/cartes-clics-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/acquisition/cartes?period=7|30|90 — les pages de bleuh.co qui ont
 * des cartes de clics sur la période, par variante (Québec / Canada), les
 * plus vues d'abord, avec vues, clics, clics sans effet et rageurs par type
 * d'écran. Lecture pour tout rôle authentifié (requireRead).
 */
export async function GET(req: NextRequest) {
  try {
    await requireRead();
    const period = parsePeriod(new URL(req.url).searchParams.get("period"));
    return NextResponse.json(await lireListeCartes(lastNDaysUtc(period)));
  } catch (error) {
    return handleError(error, "GET /api/acquisition/cartes");
  }
}
