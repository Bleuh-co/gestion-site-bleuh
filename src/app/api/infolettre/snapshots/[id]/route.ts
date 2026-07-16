import { NextRequest, NextResponse } from "next/server";
import { requireRead, requireWrite } from "@/lib/auth-server";
import { recordAudit } from "@/lib/audit";
import { adminDb } from "@/lib/firebase-admin";
import { handleError } from "@/lib/products-service";
import { deleteSnapshotFromGCS } from "@/lib/infolettre-storage";
import { INFOLETTRE_SNAPSHOTS_COLLECTION } from "@/lib/infolettre-snapshots";
import type { SnapshotDoc } from "@/lib/infolettre-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/infolettre/snapshots/[id] → détail + progression. requireRead.
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    await requireRead();
    const { id } = await ctx.params;
    const doc = await adminDb().collection(INFOLETTRE_SNAPSHOTS_COLLECTION).doc(id).get();
    if (!doc.exists) {
      return NextResponse.json(
        { error: "Snapshot introuvable.", code: "not_found" },
        { status: 404 }
      );
    }
    return NextResponse.json({ id: doc.id, ...doc.data() } as SnapshotDoc);
  } catch (error) {
    return handleError(error, "GET /api/infolettre/snapshots/[id]");
  }
}

// DELETE /api/infolettre/snapshots/[id] → supprime GCS + doc. requireWrite + audit.
export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireWrite();
    const { id } = await ctx.params;
    const ref = adminDb().collection(INFOLETTRE_SNAPSHOTS_COLLECTION).doc(id);
    const doc = await ref.get();
    if (!doc.exists) {
      return NextResponse.json(
        { error: "Snapshot introuvable.", code: "not_found" },
        { status: 404 }
      );
    }

    try {
      await deleteSnapshotFromGCS(id);
    } catch (e) {
      console.warn(`[infolettre] nettoyage GCS ignoré ${id}:`, e);
    }

    await ref.delete();
    await recordAudit(session, "infolettre.snapshot.delete", `infolettres/${id}`, {
      label: (doc.data() as SnapshotDoc | undefined)?.label,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleError(error, "DELETE /api/infolettre/snapshots/[id]");
  }
}
