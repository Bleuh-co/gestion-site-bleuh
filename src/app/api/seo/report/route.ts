import { NextResponse } from "next/server";
import { requireRead } from "@/lib/auth-server";
import { handleError } from "@/lib/products-service";
import { adminDb } from "@/lib/firebase-admin";
import type { SeoReport } from "@/lib/seo-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/seo/report — renvoie le dernier rapport SEO stocké
// (seo_reports/latest), ou { empty: true } si aucun scan n'a encore tourné.
export async function GET() {
  try {
    await requireRead();
    const snap = await adminDb().collection("seo_reports").doc("latest").get();
    if (!snap.exists) return NextResponse.json({ empty: true });
    return NextResponse.json(snap.data() as SeoReport);
  } catch (error) {
    return handleError(error, "GET /api/seo/report");
  }
}
