import { NextRequest, NextResponse } from "next/server";
import { requireRead } from "@/lib/auth-server";
import { handleError } from "@/lib/products-service";
import { adminDb } from "@/lib/firebase-admin";
import { loadSubscribersFromGCS } from "@/lib/infolettre-storage";
import { INFOLETTRE_SNAPSHOTS_COLLECTION } from "@/lib/infolettre-snapshots";
import type {
  Subscriber,
  PaginatedResult,
  SubscriberStatus,
} from "@/lib/infolettre-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/infolettre/snapshots/[id]/subscribers → abonnés du snapshot,
// paginés + filtres (charge le JSON GCS, filtre en mémoire). requireRead.
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    await requireRead();
    const { id } = await ctx.params;
    const sp = req.nextUrl.searchParams;
    const page = Math.max(1, parseInt(sp.get("page") || "1", 10));
    const limit = Math.min(parseInt(sp.get("limit") || "50", 10), 100);
    const search = (sp.get("search") || "").toLowerCase();
    const status = sp.get("status") as SubscriberStatus | null;

    const doc = await adminDb().collection(INFOLETTRE_SNAPSHOTS_COLLECTION).doc(id).get();
    if (!doc.exists) {
      return NextResponse.json(
        { error: "Snapshot introuvable.", code: "not_found" },
        { status: 404 }
      );
    }

    let subscribers: Subscriber[] = await loadSubscribersFromGCS(id);
    if (status) subscribers = subscribers.filter((s) => s.status === status);
    if (search) subscribers = subscribers.filter((s) => s.email.toLowerCase().includes(search));
    subscribers.sort((a, b) => a.email.localeCompare(b.email));

    const total = subscribers.length;
    const offset = (page - 1) * limit;
    const result: PaginatedResult<Subscriber> = {
      data: subscribers.slice(offset, offset + limit),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
    return NextResponse.json(result);
  } catch (error) {
    return handleError(error, "GET /api/infolettre/snapshots/[id]/subscribers");
  }
}
