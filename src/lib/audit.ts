import "server-only";
import { adminDb } from "./firebase-admin";
import type { SessionContext } from "./auth-server";
import type { AuditEntry } from "./types";

const COLL = "site_audit_log";

/** Journalise une action mutante (best effort — n'échoue jamais l'action métier). */
export async function recordAudit(
  actor: SessionContext,
  action: string,
  target: string,
  details?: Record<string, unknown>
): Promise<void> {
  try {
    await adminDb().collection(COLL).add({
      ts: Date.now(),
      actorEmail: actor.email,
      actorRole: actor.role,
      action,
      target,
      ...(details ? { details } : {}),
    });
  } catch (e) {
    console.warn("[audit] recordAudit failed", e);
  }
}

/** Liste paginée, plus récent d'abord. */
export async function listAudit(limit = 100): Promise<AuditEntry[]> {
  const snap = await adminDb().collection(COLL).orderBy("ts", "desc").limit(limit).get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AuditEntry, "id">) }));
}
