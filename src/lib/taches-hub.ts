import "server-only";
import { adminAuth } from "./firebase-admin";

// ─────────────────────────────────────────────────────────────
// GANDALF, AU NOM DE LA PERSONNE CONNECTÉE — pour « Relier une tâche
// existante » à une demande de page ou d'infolettre (plan « Pages
// d'atterrissage et infolettres », 22/10/2026, lot L9).
//
// Porté de `marketing-mdh/src/lib/taches-hub.ts` (même mécanisme que
// `tickets-clients/src/lib/tickets-hub.ts`). On ne lit JAMAIS
// `gandalf_tasks` en direct : la recherche passe par la route du hub
// (`GET /api/search`), qui la borne déjà aux projets dont la personne est
// membre, créatrice ou assignée — exactement ce que voit le module Tâches.
//
// Identité : un jeton personnalisé pour l'uid de la session, échangé contre
// un jeton d'identité Firebase. L'appel part donc au nom de la personne qui
// cherche, avec SES droits GANDALF — jamais au nom d'un compte de service,
// qui verrait des tâches qu'elle n'a pas le droit de voir.
// ─────────────────────────────────────────────────────────────

export function hubUrl(): string {
  return (process.env.HUB_URL || process.env.NEXT_PUBLIC_HUB_URL || "https://gandalf.chanv.com").replace(/\/+$/, "");
}

export class HubRefus extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = "HubRefus";
  }
}

export interface Personne {
  uid: string;
  email: string;
}

export interface HubDeps {
  fetch?: typeof fetch;
  jetonPerso?: (uid: string) => Promise<string>;
  cleWeb?: string;
  maintenant?: () => number;
}

const cache = new Map<string, { jeton: string; expire: number }>();

/** Pour les tests. */
export function oublierJetons(): void {
  cache.clear();
}

function courrielDuJeton(jwt: string): string {
  try {
    const charge = JSON.parse(Buffer.from(jwt.split(".")[1] || "", "base64url").toString("utf8"));
    return typeof charge.email === "string" ? charge.email.toLowerCase() : "";
  } catch {
    return "";
  }
}

async function jetonPour(qui: Personne, deps: HubDeps): Promise<string> {
  const maintenant = (deps.maintenant ?? Date.now)();
  const c = cache.get(qui.uid);
  if (c && c.expire - 5 * 60_000 > maintenant) return c.jeton;

  let perso: string;
  try {
    perso = await (deps.jetonPerso ?? ((uid: string) => adminAuth().createCustomToken(uid)))(qui.uid);
  } catch (e) {
    console.warn("[taches-hub] createCustomToken impossible :", e instanceof Error ? e.message : e);
    throw new HubRefus(
      "Marketing Bleuh n'a pas encore le droit d'agir dans GANDALF en votre nom. Cherchez la tâche directement dans GANDALF.",
      503
    );
  }
  const cle = deps.cleWeb ?? process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!cle) throw new HubRefus("Configuration Firebase absente : impossible de chercher dans GANDALF.", 501);
  const f = deps.fetch ?? fetch;
  const res = await f(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${encodeURIComponent(cle)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: perso, returnSecureToken: true }),
  });
  const j = (await res.json().catch(() => ({}))) as { idToken?: unknown; expiresIn?: unknown };
  if (!res.ok || typeof j.idToken !== "string") {
    throw new HubRefus("GANDALF n'a pas pu reconnaître la session. Recharger la page.", 502);
  }
  if (courrielDuJeton(j.idToken) !== qui.email.toLowerCase()) {
    throw new HubRefus("Le jeton GANDALF ne correspond pas à la personne connectée.", 403);
  }
  cache.set(qui.uid, { jeton: j.idToken, expire: maintenant + (Number(j.expiresIn) || 3600) * 1000 });
  return j.idToken;
}

async function appelerGet(qui: Personne, chemin: string, deps: HubDeps): Promise<Record<string, unknown>> {
  const f = deps.fetch ?? fetch;
  for (let essai = 0; essai < 2; essai++) {
    const jeton = await jetonPour(qui, deps);
    const res = await f(`${hubUrl()}${chemin}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${jeton}` },
    });
    if (res.status === 401 && essai === 0) {
      cache.delete(qui.uid);
      continue;
    }
    const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      const brut = typeof j.error === "string" ? j.error : "";
      if (res.status >= 500) {
        console.warn("[taches-hub] GANDALF en panne", res.status, brut.slice(0, 300));
        throw new HubRefus(`GANDALF a rencontré une erreur (${res.status}). Réessayez dans un instant.`, res.status);
      }
      throw new HubRefus(brut || `GANDALF a refusé (${res.status}).`, res.status);
    }
    return j;
  }
  throw new HubRefus("GANDALF refuse la session. Recharger la page.", 401);
}

/** Une tâche telle que rendue par `GET /api/search` (routes/search.js#searchTasks, forme de base). */
export interface TacheTrouvee {
  id: string;
  title: string;
  archived: boolean;
  /** « Ouverte · Nom du tableau · Assigné » — déjà composé par le hub. */
  subtitle: string;
}

/**
 * Cherche des tâches GANDALF au nom de la personne connectée —
 * `GET /api/search?q=…` (routes/search.js), la même route que la palette ⌘K
 * du hub : bornée à SES tâches (créées, assignées) et à celles des projets
 * dont elle est membre, comme le module Tâches.
 *
 * Moins de 2 caractères : le hub ne cherche pas (bruit), on ne l'appelle
 * donc pas non plus.
 */
export async function chercherTachesHub(qui: Personne, requete: string, deps: HubDeps = {}): Promise<TacheTrouvee[]> {
  const q = requete.trim();
  if (q.length < 2) return [];
  const j = await appelerGet(qui, `/api/search?q=${encodeURIComponent(q)}`, deps);
  const tasks = Array.isArray(j.tasks) ? j.tasks : [];
  return tasks
    .filter((t): t is Record<string, unknown> => !!t && typeof t === "object")
    .map((t) => ({
      id: String(t.id ?? ""),
      title: String(t.title ?? ""),
      archived: t.archived === true,
      subtitle: String(t.subtitle ?? ""),
    }))
    .filter((t) => t.id && t.title);
}
