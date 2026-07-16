import "server-only";
import { adminDb } from "./firebase-admin";
import { saveSubscribersToGCS } from "./infolettre-storage";
import type { BleuhMailerLiteClient } from "./mailerlite-bleuh";
import type { Subscriber } from "./infolettre-types";

/**
 * Cœur du flux snapshot Infolettre.
 * Métadonnées (progression) dans Firestore `infolettre_snapshots` (1 doc),
 * abonnés dans un fichier JSON GCS. Namespacé Bleuh (PAS la collection legacy
 * `ml_snapshots`).
 */

export const INFOLETTRE_SNAPSHOTS_COLLECTION = "infolettre_snapshots";

const BATCH_SIZE = 100;
// API Classic (Bleuh) : ~10 req/min → 6 s entre pages pour éviter les 429.
const THROTTLE_MS = 6_000;

/** Handle du document snapshot. */
export function snapshotRef(id: string) {
  return adminDb().collection(INFOLETTRE_SNAPSHOTS_COLLECTION).doc(id);
}

export interface SnapshotProgress {
  fetched: number;
  total: number;
  percent: number;
}

/**
 * Copie toutes les pages d'abonnés du client dans GCS, en mettant à jour la
 * progression dans Firestore à chaque page. `onProgress` permet à l'appelant
 * (route SSE) d'émettre en direct. Marque le doc `done` ou `failed`.
 *
 * @param expectedTotal count initial du compte (pour le %)
 */
export async function runSnapshotCopy(
  snapshotId: string,
  client: BleuhMailerLiteClient,
  expectedTotal: number,
  onProgress?: (p: SnapshotProgress) => void
): Promise<{ fetched: number }> {
  const ref = snapshotRef(snapshotId);
  await ref.update({ status: "running" });

  let cursor: string | null = null;
  let fetched = 0;
  const allSubscribers: Subscriber[] = [];

  try {
    do {
      const result = await client.getSubscribers({ cursor, limit: BATCH_SIZE });
      if (result.data.length === 0) break;

      allSubscribers.push(...result.data);
      fetched += result.data.length;
      cursor = result.nextCursor;

      const knownTotal = Math.max(expectedTotal, fetched);
      await ref.update({ fetchedSubscribers: fetched, totalSubscribers: knownTotal });

      if (onProgress) {
        const progressTotal = expectedTotal > 0 ? expectedTotal : fetched;
        onProgress({
          fetched,
          total: progressTotal,
          percent:
            progressTotal > 0
              ? Math.min(99, Math.round((fetched / progressTotal) * 100))
              : 0,
        });
      }

      if (cursor) await new Promise((r) => setTimeout(r, THROTTLE_MS));
    } while (cursor);

    const gcsPath = await saveSubscribersToGCS(snapshotId, allSubscribers);

    await ref.update({
      status: "done",
      fetchedSubscribers: fetched,
      totalSubscribers: fetched,
      gcsPath,
      completedAt: new Date().toISOString(),
    });

    return { fetched };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur inconnue";
    console.error(`[infolettre/snapshot:${snapshotId}] échec:`, message);
    await ref.update({ status: "failed", errorMessage: message, fetchedSubscribers: fetched });
    throw e;
  }
}
