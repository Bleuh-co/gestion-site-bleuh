import "server-only";
import { cert, getApps, initializeApp, applicationDefault, type App } from "firebase-admin/app";
import { getAuth, type Auth as AdminAuth } from "firebase-admin/auth";
import { getFirestore, type Firestore as AdminFirestore } from "firebase-admin/firestore";

declare global {
  // eslint-disable-next-line no-var
  var __gestiSiteBleuhAdminApp: App | undefined;
  // eslint-disable-next-line no-var
  var __gestiSiteBleuhAdminDb: AdminFirestore | undefined;
  // eslint-disable-next-line no-var
  var __gestiSiteBleuhFirestoreSettingsApplied: boolean | undefined;
}

function getServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed.private_key === "string") {
      parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
    }
    return parsed;
  } catch (e) {
    console.error("[firebase-admin] FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON", e);
    return null;
  }
}

export function firebaseAdmin(): App {
  if (globalThis.__gestiSiteBleuhAdminApp) return globalThis.__gestiSiteBleuhAdminApp;
  const existing = getApps()[0];
  if (existing) {
    globalThis.__gestiSiteBleuhAdminApp = existing;
    return existing;
  }
  const sa = getServiceAccount();
  const app = sa
    ? initializeApp({ credential: cert(sa), projectId: sa.project_id })
    : initializeApp({ credential: applicationDefault() });
  globalThis.__gestiSiteBleuhAdminApp = app;
  return app;
}

export function adminAuth(): AdminAuth {
  return getAuth(firebaseAdmin());
}

export function adminDb(): AdminFirestore {
  if (globalThis.__gestiSiteBleuhAdminDb) return globalThis.__gestiSiteBleuhAdminDb;
  const db = getFirestore(firebaseAdmin());
  if (!globalThis.__gestiSiteBleuhFirestoreSettingsApplied) {
    try {
      db.settings({ ignoreUndefinedProperties: true });
    } catch (e: any) {
      console.warn("[firebase-admin] settings() ignoré:", e?.message);
    }
    globalThis.__gestiSiteBleuhFirestoreSettingsApplied = true;
  }
  globalThis.__gestiSiteBleuhAdminDb = db;
  return db;
}

export function getServiceAccountForGoogle() {
  return getServiceAccount();
}
