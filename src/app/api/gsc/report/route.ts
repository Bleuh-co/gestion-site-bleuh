import { NextRequest, NextResponse } from "next/server";
import { requireRead } from "@/lib/auth-server";
import { handleError } from "@/lib/products-service";
import { readReport } from "@/lib/gsc-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/gsc/report — série quotidienne Search Console archivée dans
 * Firestore : `days` (date + totaux, pour les graphiques) et `latest`
 * (dernier jour complet : top requêtes, pages, appareils, pays, sitemaps).
 *
 * `?days=N` (1..550, défaut 28) : profondeur de la série.
 * Renvoie { empty: true } tant qu'aucune synchronisation n'a tourné.
 */
export async function GET(req: NextRequest) {
  try {
    await requireRead();
    const raw = Number(new URL(req.url).searchParams.get("days") ?? "28");
    const days = Number.isFinite(raw) ? Math.min(Math.max(Math.trunc(raw), 1), 550) : 28;
    const report = await readReport(days);
    if (report.latest === null) return NextResponse.json({ empty: true });
    return NextResponse.json(report);
  } catch (error) {
    return handleError(error, "GET /api/gsc/report");
  }
}
