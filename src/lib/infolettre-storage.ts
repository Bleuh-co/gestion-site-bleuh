import "server-only";
import { getStorage } from "firebase-admin/storage";
import { firebaseAdmin, getServiceAccountForGoogle } from "./firebase-admin";
import type { Subscriber } from "./infolettre-types";

/**
 * Cloud Storage pour les snapshots Infolettre (MailerLite Bleuh).
 * Les abonnés d'un snapshot sont stockés dans un seul fichier JSON.
 *
 * Namespacé Bleuh — préfixe `bleuh-ml-snapshots/` pour NE PAS collisionner
 * avec l'app legacy gestionnaire-donnees-mailerlite (`ml-snapshots/`).
 *
 * Structure : bleuh-ml-snapshots/{snapshotId}.json
 */

const BUCKET_FOLDER = "bleuh-ml-snapshots";

function getBucket() {
  // Var explicite, sinon dérivé du project_id du service account.
  let bucketName = process.env.GCS_BUCKET;
  if (!bucketName) {
    const sa = getServiceAccountForGoogle();
    const projectId =
      sa?.project_id || process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
    if (projectId) {
      bucketName = `${projectId}.firebasestorage.app`;
    }
  }
  if (!bucketName) {
    throw new Error(
      "Bucket GCS non configuré. Définir GCS_BUCKET ou FIREBASE_SERVICE_ACCOUNT_JSON."
    );
  }
  return getStorage(firebaseAdmin()).bucket(bucketName);
}

function snapshotPath(snapshotId: string): string {
  return `${BUCKET_FOLDER}/${snapshotId}.json`;
}

/** Sauvegarde les abonnés d'un snapshot en fichier JSON (gzip) dans GCS. */
export async function saveSubscribersToGCS(
  snapshotId: string,
  subscribers: Subscriber[]
): Promise<string> {
  const bucket = getBucket();
  const filePath = snapshotPath(snapshotId);
  const file = bucket.file(filePath);

  const json = JSON.stringify(subscribers);
  await file.save(json, {
    contentType: "application/json",
    gzip: true,
    metadata: { cacheControl: "private, max-age=0" },
  });

  console.log(
    `[infolettre/gcs] ${subscribers.length} abonnés → gs://${bucket.name}/${filePath} (${(json.length / 1024).toFixed(0)} KB)`
  );
  return filePath;
}

/** Charge les abonnés d'un snapshot depuis GCS (tableau en mémoire). */
export async function loadSubscribersFromGCS(
  snapshotId: string
): Promise<Subscriber[]> {
  const bucket = getBucket();
  const file = bucket.file(snapshotPath(snapshotId));

  const [exists] = await file.exists();
  if (!exists) return [];

  const [buffer] = await file.download();
  return JSON.parse(buffer.toString("utf-8")) as Subscriber[];
}

/** Supprime le fichier JSON d'un snapshot. */
export async function deleteSnapshotFromGCS(snapshotId: string): Promise<void> {
  const bucket = getBucket();
  const file = bucket.file(snapshotPath(snapshotId));

  const [exists] = await file.exists();
  if (exists) {
    await file.delete();
    console.log(`[infolettre/gcs] Supprimé gs://${bucket.name}/${snapshotPath(snapshotId)}`);
  }
}
