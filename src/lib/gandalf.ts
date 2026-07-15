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
 * le SDK. Retourne l'enum Role (dont "blocked", listé dans noAccessRoles → refus).
 */
export const appRoleMapper = (email: string): Promise<string> => resolveRole(email);
