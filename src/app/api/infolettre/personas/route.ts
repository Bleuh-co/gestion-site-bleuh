import { NextResponse } from "next/server";
import { requireRead } from "@/lib/auth-server";
import { adminDb } from "@/lib/firebase-admin";
import { handleError } from "@/lib/products-service";
import { METRICS_COLLECTION } from "@/lib/infolettre-collect";
import type { MetricsSnapshot } from "@/lib/infolettre-metrics-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/infolettre/personas → actifs par persona, tels que comptés par la
// dernière capture qui a réussi le calcul (collecteur, toutes les 6 h).
// Rien d'appelé chez MailerLite ici : le parcours de la liste prend ~1 min.
// requireRead.
export async function GET() {
  try {
    await requireRead();
    const snap = await adminDb()
      .collection(METRICS_COLLECTION)
      .orderBy("capturedAt", "desc")
      .limit(8)
      .get();
    const latest = snap.docs.map((d) => d.data() as MetricsSnapshot).find((m) => m.byPersona);
    return NextResponse.json({
      capturedAt: latest?.capturedAt ?? null,
      byPersona: latest?.byPersona ?? null,
    });
  } catch (error) {
    return handleError(error, "GET /api/infolettre/personas");
  }
}
