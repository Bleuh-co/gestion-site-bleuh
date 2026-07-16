import { NextRequest } from "next/server";
import { requireWrite } from "@/lib/auth-server";
import { recordAudit } from "@/lib/audit";
import { adminDb } from "@/lib/firebase-admin";
import { getBleuhClient } from "@/lib/mailerlite-bleuh";
import {
  INFOLETTRE_SNAPSHOTS_COLLECTION,
  runSnapshotCopy,
} from "@/lib/infolettre-snapshots";
import type { SnapshotDoc } from "@/lib/infolettre-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function jsonError(status: number, error: string, code?: string): Response {
  return new Response(JSON.stringify({ error, ...(code ? { code } : {}) }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * POST /api/infolettre/snapshots/stream — crée un snapshot avec progression SSE.
 * La requête reste ouverte pendant toute la copie (Cloud Run garde le CPU actif).
 * Fail-safe : si le client se déconnecte, la copie continue en arrière-plan.
 * requireWrite (extraction PII) + audit.
 */
export async function POST(req: NextRequest) {
  let session;
  try {
    session = await requireWrite();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "UNAUTHORIZED") return jsonError(401, "Non authentifié.", "unauthorized");
    return jsonError(403, "Accès refusé.", "forbidden");
  }

  const client = getBleuhClient();
  if (!client) return jsonError(503, "MailerLite Bleuh non configuré.", "not_configured");

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const scope = (body.scope as "all" | "group") || "all";
  const groupId = typeof body.groupId === "string" ? body.groupId : undefined;
  const label = typeof body.label === "string" ? body.label : undefined;
  if (scope === "group" && !groupId) {
    return jsonError(400, "groupId requis pour scope=group.", "validation_error");
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let clientConnected = true;
      function sendEvent(event: string, data: unknown) {
        if (!clientConnected) return;
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        } catch {
          clientConnected = false;
          console.warn("[infolettre/stream] client déconnecté, copie continue en fond");
        }
      }

      const heartbeat = setInterval(() => {
        if (!clientConnected) return;
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          clientConnected = false;
        }
      }, 3_000);

      try {
        sendEvent("status", { message: "Chargement des informations du compte…" });
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
          status: "running",
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

        await recordAudit(session, "infolettre.snapshot.create", `infolettres/${snapshotId}`, {
          label: defaultLabel,
          scope,
          groupId,
          totalSubscribers: info.subscriberCount,
          via: "stream",
        });

        sendEvent("created", {
          id: snapshotId,
          label: defaultLabel,
          totalSubscribers: info.subscriberCount,
        });

        try {
          const { fetched } = await runSnapshotCopy(
            snapshotId,
            client,
            info.subscriberCount,
            (p) => sendEvent("progress", p)
          );
          sendEvent("completed", { id: snapshotId, totalSubscribers: fetched });
        } catch (innerErr) {
          const message = innerErr instanceof Error ? innerErr.message : "Erreur inconnue";
          sendEvent("error", { message });
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : "Erreur inconnue";
        console.error("[infolettre/stream] init error:", message);
        sendEvent("error", { message });
      } finally {
        clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          /* déjà fermé */
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
