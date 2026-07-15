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
  // eslint-disable-next-line no-var
  var __gestiSiteBleuhChatDb: AdminFirestore | undefined;
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

/**
 * Firestore du bot Bleuh (bleuh-chat) — collections `chat_usage`/`chat_sessions`.
 *
 * Par défaut, on suppose que le service account de gestion-site-bleuh (projet
 * embarqué dans FIREBASE_SERVICE_ACCOUNT_JSON) a accès au même projet que le
 * bot en prod (Hub Gandalf — `apps`/`user_app_roles`/`users` y résident déjà),
 * et on réutilise adminDb(). Si le bot tourne dans un AUTRE projet GCP, poser
 * BLEUHCHAT_PROJECT_ID pour cibler explicitement ce projet via une seconde
 * app Admin (le service account doit alors avoir un accès IAM cross-projet
 * — Cloud Datastore User — sur ce projet ; à défaut les lectures échoueront
 * et le module Analyse CEO dégrade proprement vers des KPIs à 0).
 */
export function chatDb(): AdminFirestore {
  const overrideProjectId = process.env.BLEUHCHAT_PROJECT_ID;
  if (!overrideProjectId) return adminDb();

  if (globalThis.__gestiSiteBleuhChatDb) return globalThis.__gestiSiteBleuhChatDb;

  const sa = getServiceAccount();
  const APP_NAME = "bleuh-chat";
  const existing = getApps().find((a) => a.name === APP_NAME);
  const app =
    existing ||
    initializeApp(
      sa
        ? { credential: cert(sa), projectId: overrideProjectId }
        : { credential: applicationDefault(), projectId: overrideProjectId },
      APP_NAME
    );
  const db = getFirestore(app);
  globalThis.__gestiSiteBleuhChatDb = db;
  return db;
}
