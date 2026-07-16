import { NextResponse } from "next/server";
import { requireWrite } from "@/lib/auth-server";
import { recordAudit } from "@/lib/audit";
import { handleError } from "@/lib/products-service";
import { adminDb } from "@/lib/firebase-admin";
import { runSeoScan } from "@/lib/seo-analyzer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COLL = "seo_reports";

// POST /api/seo/scan — lance un scan SEO du site public SiteBleuh, stocke le
// rapport dans Firestore (seo_reports/latest + historique) et le renvoie.
// Coûte des requêtes réseau externes → requireWrite (gestionnaire et plus).
export async function POST() {
  try {
    const session = await requireWrite();
    const report = await runSeoScan();

    // Persistance best-effort : n'échoue pas la réponse si Firestore refuse.
    try {
      const coll = adminDb().collection(COLL);
      await coll.doc("latest").set(report);
      await coll.doc(report.generatedAt).set(report);
    } catch (e) {
      console.warn("[seo.scan] persistance Firestore échouée :", e);
    }

    await recordAudit(session, "seo.scan.run", `seo/${report.baseUrl}`, {
      score: report.score,
      pagesScanned: report.pagesScanned,
      issues: report.issues.length,
    });

    return NextResponse.json(report);
  } catch (error) {
    return handleError(error, "POST /api/seo/scan");
  }
}
