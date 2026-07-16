import { NextRequest, NextResponse } from "next/server";
import { requireRead, requireWrite } from "@/lib/auth-server";
import { recordAudit } from "@/lib/audit";
import { adminDb } from "@/lib/firebase-admin";
import { handleError, ValidationError } from "@/lib/products-service";
import { getBleuhClient } from "@/lib/mailerlite-bleuh";
import {
  INFOLETTRE_SNAPSHOTS_COLLECTION,
  runSnapshotCopy,
} from "@/lib/infolettre-snapshots";
import type { SnapshotDoc, SnapshotStatus } from "@/lib/infolettre-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/infolettre/snapshots → liste (createdAt desc, max 100). requireRead.
export async function GET(req: NextRequest) {
  try {
    await requireRead();
    const sp = req.nextUrl.searchParams;
    const status = sp.get("status") as SnapshotStatus | null;

    let query: FirebaseFirestore.Query = adminDb()
      .collection(INFOLETTRE_SNAPSHOTS_COLLECTION)
      .orderBy("createdAt", "desc")
      .limit(100);
    if (status) query = query.where("status", "==", status);

    const snap = await query.get();
    const snapshots: SnapshotDoc[] = snap.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<SnapshotDoc, "id">),
    }));
    return NextResponse.json(snapshots);
  } catch (error) {
    return handleError(error, "GET /api/infolettre/snapshots");
  }
}

// POST /api/infolettre/snapshots → crée un snapshot (copie en arrière-plan).
// requireWrite (extraction PII en masse) + audit. Répond immédiatement
// `status:"running"` ; la progression se suit via GET [id] (poll Firestore),
// ou en direct via POST /snapshots/stream (SSE).
export async function POST(req: NextRequest) {
  try {
    const session = await requireWrite();

    const client = getBleuhClient();
    if (!client) {
      return NextResponse.json(
        { error: "MailerLite Bleuh non configuré.", code: "not_configured" },
        { status: 503 }
      );
    }

    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      throw new ValidationError("Corps de requête JSON invalide.");
    }

    const scope = (body.scope as "all" | "group") || "all";
    const groupId = typeof body.groupId === "string" ? body.groupId : undefined;
    const label = typeof body.label === "string" ? body.label : undefined;
    if (scope === "group" && !groupId) {
      throw new ValidationError("groupId requis pour scope=group.");
    }

    const [info, fields] = await Promise.all([
      client.getAccountInfo(),
      client.getFields(),
    ]);

    let groupName: string | undefined;
    if (scope === "group" && groupId) {
      const groups = await client.getGroups();
      groupName = groups.find((g) => g.id === groupId)?.name || groupId;
    }

    const defaultLabel =
      label ||
      `Copie ${client.label}${groupName ? ` — ${groupName}` : ""} — ${new Date().toLocaleDateString("fr-CA")}`;

    const snapshotData: Omit<SnapshotDoc, "id"> = {
      accountId: client.id,
      accountLabel: client.label,
      label: defaultLabel,
      status: "pending",
      scope,
      ...(groupId && { groupId }),
      ...(groupName && { groupName }),
      totalSubscribers: info.subscriberCount,
      fetchedSubscribers: 0,
      fields,
      createdAt: new Date().toISOString(),
      createdByEmail: session.email,
    };

    const docRef = await adminDb()
      .collection(INFOLETTRE_SNAPSHOTS_COLLECTION)
      .add(snapshotData);
    const snapshotId = docRef.id;

    // Copie en arrière-plan (ne bloque pas la réponse).
    runSnapshotCopy(snapshotId, client, info.subscriberCount).catch((err) => {
      console.error(`[infolettre/snapshot] copie de fond échouée ${snapshotId}:`, err);
    });

    await recordAudit(session, "infolettre.snapshot.create", `infolettres/${snapshotId}`, {
      label: defaultLabel,
      scope,
      groupId,
      totalSubscribers: info.subscriberCount,
    });

    return NextResponse.json(
      { id: snapshotId, ...snapshotData, status: "running" },
      { status: 201 }
    );
  } catch (error) {
    return handleError(error, "POST /api/infolettre/snapshots");
  }
}
