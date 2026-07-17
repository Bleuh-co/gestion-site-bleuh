import "server-only";
import { adminAuth, adminDb } from "./firebase-admin";
import { isEmailDomainAllowed } from "./utils";
import type { Role } from "./types";

const SESSION_COOKIE = "__session";
const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 5; // 5 jours

export async function createSessionCookie(idToken: string): Promise<string> {
  return adminAuth().createSessionCookie(idToken, { expiresIn: SESSION_MAX_AGE_MS });
}

export function sessionCookieOptions() {
  // L'app est servie sur marketing.bleuh.co et embarquée dans le hub
  // gandalf.chanv.com → contexte CROSS-SITE (domaines enregistrables différents,
  // contrairement aux apps *.chanv.com qui sont same-site avec le hub). Un cookie
  // SameSite=Lax n'est PAS envoyé dans une iframe cross-site : chaque navigation
  // SSR repart sur /login (boucle) et l'app ne s'ouvre jamais en embarqué.
  //   → SameSite=None (+ Secure obligatoire) : le cookie voyage dans l'iframe.
  //   → Partitioned (CHIPS) : il survit au blocage des cookies tiers (le jar est
  //     partitionné par le site de premier niveau — gandalf.chanv.com en embed,
  //     marketing.bleuh.co en standalone ; chaque contexte s'authentifie seul).
  // En dev (HTTP), Secure impossible → repli SameSite=Lax.
  const isProd = process.env.NODE_ENV === "production";
  return {
    name: SESSION_COOKIE,
    httpOnly: true,
    secure: isProd,
    sameSite: (isProd ? "none" : "lax") as "none" | "lax",
    partitioned: isProd,
    path: "/",
    maxAge: SESSION_MAX_AGE_MS / 1000,
  };
}

export interface SessionContext {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  role: Role;
}

const BOOTSTRAP_ADMINS = ["t.matteucci@chanv.com", "mathieu@lafeuilleverte.ca"];

function mapStandardRole(grade: string): Role {
  switch (grade) {
    case "Super Administrateur":
      return "superadmin";
    case "Administrateur":
      return "admin";
    case "Gestionnaire":
      return "gestionnaire";
    case "Consulter":
      return "consultant";
    case "Non visible":
      return "blocked";
    default:
      return "blocked";
  }
}

function mapLegacyToStandard(oldRole: string): string {
  switch (oldRole) {
    case "SuperAdmin":
      return "Super Administrateur";
    case "Admin":
      return "Administrateur";
    case "Gestionnaire":
      return "Gestionnaire";
    case "Employe":
      return "Consulter";
    default:
      // Deny-by-default (contrat recette) : un rôle Hub inconnu ne donne
      // PLUS « Consulter » — il tombe sur « Non visible » → blocked.
      return "Non visible";
  }
}

/**
 * Résout l'ID Firestore de l'app Gestion Site Bleuh dans la collection `apps`.
 *
 * Priorité 1 : variable d'env GESTIONSITEBLEUH_APP_ID (direct, zéro ambiguïté).
 * Priorité 2 : matcher par nom dans la collection apps (fallback dev).
 */
async function resolveGestiSiteBleuhAppId(
  db: FirebaseFirestore.Firestore
): Promise<{ appId: string; appName: string | null }> {
  const override = process.env.GESTIONSITEBLEUH_APP_ID;
  if (override) {
    let appName: string | null = null;
    try {
      const snap = await db.collection("apps").doc(override).get();
      appName = (snap.data()?.name as string) || null;
    } catch {
      /* ignore */
    }
    return { appId: override, appName };
  }
  const appsSnap = await db.collection("apps").get();
  const match = appsSnap.docs.find((d) => {
    const name = (d.data().name || "").toLowerCase().replace(/\s+/g, "");
    // Jeton stable « gestionsitebleuh » (l'env GESTIONSITEBLEUH_APP_ID prime).
    // Retiré le reliquat copié-collé « duplication/taches ».
    return name.includes("gestionsitebleuh");
  });
  return { appId: match?.id || "", appName: (match?.data().name as string) || null };
}

export interface RoleResolution {
  email: string;
  isBootstrap: boolean;
  appId: string;
  appName: string | null;
  userAppRoleGrade: string | null;
  legacyGlobalRole: string | null;
  source: "bootstrap" | "user_app_roles" | "legacy_global" | "default";
  role: Role;
}

/**
 * Variante "verbose" — retourne le détail de la résolution. Sert au
 * endpoint de diagnostic /api/whoami et à resolveRole().
 */
export async function resolveRoleVerbose(email: string): Promise<RoleResolution> {
  const emailKey = email.toLowerCase();
  const base: RoleResolution = {
    email: emailKey,
    isBootstrap: false,
    appId: "",
    appName: null,
    userAppRoleGrade: null,
    legacyGlobalRole: null,
    source: "default",
    // Deny-by-default (contrat recette) : aucune autorisation explicite
    // (registre, rôle Hub, bootstrap) = refusé. Avant : « membre ».
    role: "blocked",
  };

  // 1. Bootstrap
  if (BOOTSTRAP_ADMINS.includes(emailKey)) {
    return { ...base, isBootstrap: true, source: "bootstrap", role: "superadmin" };
  }

  const db = adminDb();

  // 2. user_app_roles via l'app ID (env override OU matcher par nom)
  try {
    const { appId, appName } = await resolveGestiSiteBleuhAppId(db);
    base.appId = appId;
    base.appName = appName;
    if (appId) {
      const roleDoc = await db.collection("user_app_roles").doc(`${emailKey}__${appId}`).get();
      if (roleDoc.exists) {
        const grade = (roleDoc.data()?.role || "") as string;
        base.userAppRoleGrade = grade;
        return { ...base, source: "user_app_roles", role: mapStandardRole(grade) };
      }
    }
  } catch (e) {
    console.warn("[auth] user_app_roles lookup failed", e);
  }

  // 3. users.role legacy (rôle global Hub) — fallback
  try {
    const userDoc = await db.collection("users").doc(emailKey).get();
    if (userDoc.exists) {
      const data = userDoc.data() || {};
      const hubRole = (data.role as string) || "Invite";
      base.legacyGlobalRole = hubRole;
      if (
        hubRole === "Super Administrateur" ||
        hubRole === "Administrateur" ||
        hubRole === "Gestionnaire" ||
        hubRole === "Consulter" ||
        hubRole === "Non visible"
      ) {
        return { ...base, source: "legacy_global", role: mapStandardRole(hubRole) };
      }
      return {
        ...base,
        source: "legacy_global",
        role: mapStandardRole(mapLegacyToStandard(hubRole)),
      };
    }
  } catch (e) {
    console.warn("[auth] users lookup failed", e);
  }

  // 4. Deny-by-default (contrat recette) : aucune autorisation trouvée = refusé.
  //    Avant : « membre » (ouvert au domaine) — n'importe quel compte du domaine
  //    entrait sans rôle attribué. Désormais, il faut un grade au registre
  //    user_app_roles/{email}__{appId} (posé via le gestionnaire du Hub) OU un
  //    rôle Hub reconnu. Les bootstrap admins gardent l'accès (étape 1).
  return { ...base, source: "default", role: "blocked" };
}

/**
 * Résout le rôle pour un email donné. Priorité :
 *   1. Bootstrap admins → superadmin
 *   2. user_app_roles (clé `${email}__${appId}`) → mapping
 *   3. users.role legacy global → mapping (fallback)
 *   4. Deny-by-default → blocked
 */
export async function resolveRole(email: string): Promise<Role> {
  const r = await resolveRoleVerbose(email);
  return r.role;
}

// --- Whitelist (utilisateurs invites hors-domaine) ---------------------------
// Un email hors domaine (gmail, etc.) est autorise au gate SEULEMENT s'il a ete
// invite via le hub : users/{email}.invited === true. isEmailAllowed = domaine
// autorise OU whiteliste. Le ROLE decide ensuite (deny-by-default inchange).
export async function isWhitelisted(email: string | null | undefined): Promise<boolean> {
  const e = (email || "").toLowerCase().trim();
  if (!e) return false;
  try {
    const doc = await adminDb().collection("users").doc(e).get();
    return doc.exists && doc.data()?.invited === true;
  } catch { return false; }
}
export async function isEmailAllowed(email: string | null | undefined): Promise<boolean> {
  if (isEmailDomainAllowed(email)) return true;
  return isWhitelisted(email);
}

export async function getSession(): Promise<SessionContext | null> {
  // Garde d'accès via le SDK Gandalf : cookie __session de l'app OU cookie hub
  // partagé __gandalf_session OU Bearer ; check d'audience ; deny-by-default.
  // La résolution de rôle reste celle de l'app (resolveRole) via roleMapper.
  const { verifySso, GandalfDenied } = await import("@bleuh-co/gandalf-sdk-next/server");
  const { gandalfAdmin, appRoleMapper } = await import("./gandalf");
  try {
    const s = await verifySso(gandalfAdmin, {
      cookieName: SESSION_COOKIE,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      noAccessRoles: ["blocked"],
      roleMapper: appRoleMapper,
    });
    if (!(await isEmailAllowed(s.user.email))) return null;
    return {
      uid: s.user.uid,
      email: s.user.email,
      displayName: s.user.name,
      photoURL: s.user.picture,
      role: s.role as Role,
    };
  } catch (e) {
    if (e instanceof GandalfDenied) return null;
    console.warn("[auth] getSession error", e);
    return null;
  }
}

export async function requireSession(): Promise<SessionContext> {
  const s = await getSession();
  if (!s) throw new Error("UNAUTHORIZED");
  return s;
}

/** Lecture : tout rôle authentifié non bloqué (consultant et plus). */
export async function requireRead(): Promise<SessionContext> {
  return requireSession();
}

/** Écriture : gestionnaire, admin ou superadmin. */
export async function requireWrite(): Promise<SessionContext> {
  const s = await requireSession();
  if (s.role !== "gestionnaire" && s.role !== "admin" && s.role !== "superadmin") {
    throw new Error("FORBIDDEN");
  }
  return s;
}

/** Journaux d'audit : admin ou superadmin uniquement. */
export async function requireAudit(): Promise<SessionContext> {
  const s = await requireSession();
  if (s.role !== "admin" && s.role !== "superadmin") throw new Error("FORBIDDEN");
  return s;
}

/** @deprecated conservé pour compat — équivaut à requireAudit (admin+). */
export async function requireAdmin(): Promise<SessionContext> {
  return requireAudit();
}

export { SESSION_COOKIE };
