import "server-only";
import type { AdminLike } from "@bleuh-co/gandalf-sdk-next/server";
import { adminAuth, adminDb } from "./firebase-admin";
import { resolveRole } from "./auth-server";

/**
 * Adaptateur firebase-admin → contrat AdminLike du SDK Gandalf.
 * L'app expose adminAuth()/adminDb() ; le SDK attend admin.auth()/admin.firestore().
 */
export const gandalfAdmin: AdminLike = {
  auth: () => adminAuth() as any,
  firestore: () => adminDb() as any,
};

/**
 * roleMapper : branche la résolution de rôle propre à Gestion Site Bleuh dans
 * le SDK.
 *
 * Règles EXACTES actuelles (resolveRole, inchangé) :
 *   - grade Gandalf "Non visible", ou grade legacy/hub non reconnu (deny-by-
 *     default) → rôle "blocked"
 *   - sinon → rôle résolu parmi superadmin/admin/gestionnaire/consultant
 *
 * On projette ce refus d'accès sur l'enum : tout email non autorisé retourne
 * "blocked", listé dans noAccessRoles (auth-server.ts) → GandalfDenied.
 */
export const appRoleMapper = (email: string): Promise<string> => resolveRole(email);
