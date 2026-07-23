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
  // eslint-disable-next-line no-var
  var __gestiSiteBleuhShopDb: AdminFirestore | undefined;
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

/**
 * Firestore de la boutique Bleuh — collections `shop_*` (produits, commandes,
 * coupons, compteurs) du projet antigravity-20260107. Décision propriétaire
 * (2026-07) : séparation totale de WordPress/WooCommerce — la gestion est le
 * MAÎTRE du catalogue, données dans CE Firestore (partagé avec bleuh-chat,
 * collections chat_* — on ne touche qu'aux collections préfixées shop_).
 *
 * Cible par défaut le projet antigravity-20260107 via une app Admin dédiée
 * (le projet du FIREBASE_SERVICE_ACCOUNT_JSON de gestion n'est pas celui-là).
 * SHOPBLEUH_PROJECT_ID permet d'overrider la cible (même pattern que
 * BLEUHCHAT_PROJECT_ID/chatDb() ci-dessus). Le service account doit avoir un
 * accès IAM cross-projet (Cloud Datastore User) sur le projet cible.
 */
export function shopDb(): AdminFirestore {
  if (globalThis.__gestiSiteBleuhShopDb) return globalThis.__gestiSiteBleuhShopDb;

  const projectId = process.env.SHOPBLEUH_PROJECT_ID || "antigravity-20260107";
  // ADC d'abord (et non le JSON FIREBASE_SERVICE_ACCOUNT_JSON) : le service
  // tourne DANS le projet antigravity-20260107, son SA runtime a déjà accès à
  // Firestore — aucun grant IAM cross-projet à maintenir. Le JSON reste le
  // repli si un jour le service migre hors du projet (SHOPBLEUH_USE_SA=1).
  const useSa = process.env.SHOPBLEUH_USE_SA === "1";
  const sa = useSa ? getServiceAccount() : null;
  const APP_NAME = "shop-bleuh";
  const existing = getApps().find((a) => a.name === APP_NAME);
  const app =
    existing ||
    initializeApp(
      sa
        ? { credential: cert(sa), projectId }
        : { credential: applicationDefault(), projectId },
      APP_NAME
    );
  const db = getFirestore(app);
  if (!existing) {
    try {
      db.settings({ ignoreUndefinedProperties: true });
    } catch (e: any) {
      console.warn("[firebase-admin] shopDb settings() ignoré:", e?.message);
    }
  }
  globalThis.__gestiSiteBleuhShopDb = db;
  return db;
}
