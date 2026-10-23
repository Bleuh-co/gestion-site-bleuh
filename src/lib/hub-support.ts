import "server-only";
import type { EspaceFil } from "./fils-pure";

/**
 * Les signalements de Marketing Bleuh dans Support Web —
 * `POST /api/support/service` du hub, et son annulation
 * `POST /api/support/service/annuler` (plan « Pages d'atterrissage et
 * infolettres », 22/10/2026 : porte ouverte au lot L2, ce module au lot L9).
 * Plus, depuis le CONTRAT v2 de la discussion GANDALF (lots L10/L12) :
 * `POST /api/fils/service/supprimer`, pour effacer la discussion d'une page
 * ou d'une campagne supprimée.
 *
 * Porté de `marketing-mdh/src/lib/hub-support.ts`. Deux différences :
 *   - l'intégration est `marketing_bleuh` et la cible `site-bleuh` (le hub
 *     refuse toute autre paire, routes/support-service.js#INTEGRATIONS) ;
 *   - deux sortes de demande, « page » (objet `atterrissage`) et
 *     « infolettre » (objet `infolettre`), là où MDH n'envoie que des pages.
 *
 * La clé est la MÊME que celle de `/api/notifications` (`NOTIF_API_KEY`,
 * repli `GANDALF_NOTIF_KEY`) — aucune variable d'environnement de plus que
 * `GESTIONSITEBLEUH_APP_ID` (déjà lue par fils-store.ts, même source).
 *
 * IDEMPOTENT : `external_key` rend un rejeu sans danger (le hub répond
 * `created:false` avec le MÊME id). On peut renvoyer une demande déjà partie
 * sans jamais doubler le signalement dans Support Web.
 */

const HUB_URL = (): string =>
  (process.env.HUB_URL || process.env.NEXT_PUBLIC_HUB_URL || "https://gandalf.chanv.com").replace(/\/+$/, "");

/** Intégration et cible admises par le hub pour Marketing Bleuh. */
export const INTEGRATION = "marketing_bleuh";
export const APP_CIBLE = "site-bleuh";

export type SorteDemande = "page" | "infolettre";

/** L'objet que chaque sorte porte dans le corps de la requête (contrat du hub, TYPES). */
const OBJET_DE_LA_SORTE: Record<SorteDemande, "atterrissage" | "infolettre"> = {
  page: "atterrissage",
  infolettre: "infolettre",
};

/**
 * `marketing-bleuh:atterrissage:<id>` / `marketing-bleuh:infolettre:<id>` —
 * LE seul endroit qui compose ces clés : envoi, renvoi et annulation doivent
 * produire exactement la même.
 */
export function cleExterne(sorte: SorteDemande, objetId: string): string {
  return `marketing-bleuh:${OBJET_DE_LA_SORTE[sorte]}:${objetId}`;
}

export interface Signalement {
  sorte: SorteDemande;
  external_key: string;
  reporterEmail: string;
  title: string;
  message: string;
  /** 5 au plus, en https — vérifié par l'appelant ; le hub refuse au-delà. */
  images: string[];
  tacheReliee: string | null;
  /** La fiche (page) ou l'envoi (infolettre) dans Marketing Bleuh. `lien` en https. */
  objet: { id: string; lien: string };
}

export interface EnvoiSignalementResult {
  ok: boolean;
  id?: string;
  created?: boolean;
  status?: number;
  /** Message prêt pour l'écran — jamais une trace technique brute. */
  error?: string;
}

export interface AnnulationResult {
  ok: boolean;
  id?: string;
  /** `false` quand le signalement était déjà résolu : rien n'a changé. */
  annule?: boolean;
  status?: number;
  error?: string;
}

export interface HubSupportDeps {
  fetch?: typeof fetch;
}

function cleDuHub(): string {
  return (process.env.NOTIF_API_KEY || process.env.GANDALF_NOTIF_KEY || "").trim();
}

/**
 * Un POST au hub, réponse ramenée à `{ok, status, corps}` ou à un message
 * d'écran. Ne lève JAMAIS.
 */
async function poster(
  chemin: string,
  corps: Record<string, unknown>,
  quoi: string,
  deps: HubSupportDeps
): Promise<{ ok: true; status: number; j: Record<string, unknown> } | { ok: false; status?: number; error: string }> {
  const key = cleDuHub();
  if (!key) {
    console.warn(`[hub-support] NOTIF_API_KEY absente — ${quoi} non transmis.`);
    return { ok: false, error: "Configuration incomplète (clé du hub absente) : la demande n'a pas pu être transmise à l'équipe du site." };
  }
  const f = deps.fetch ?? fetch;
  let res: Response;
  try {
    res = await f(`${HUB_URL()}${chemin}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": key },
      body: JSON.stringify(corps),
    });
  } catch (e) {
    console.warn("[hub-support] GANDALF injoignable :", e instanceof Error ? e.message : e);
    return { ok: false, error: "GANDALF est injoignable pour l'instant. Réessayez dans un instant." };
  }
  const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || j.ok === false) {
    const brut = typeof j.error === "string" ? j.error : "";
    if (res.status >= 500) {
      console.warn("[hub-support] GANDALF en panne", res.status, brut.slice(0, 300));
      return { ok: false, status: res.status, error: `GANDALF a rencontré une erreur (${res.status}). Réessayez dans un instant.` };
    }
    return { ok: false, status: res.status, error: brut || `GANDALF a refusé la demande (${res.status}).` };
  }
  return { ok: true, status: res.status, j };
}

/**
 * Transmet le signalement. Ne lève JAMAIS : un refus ou une panne du hub
 * rend `{ok:false, error}`, à afficher tel quel — la fiche ou l'envoi, lui, a
 * déjà été créé côté Marketing Bleuh et reste utilisable (« demande non
 * transmise », avec un bouton pour renvoyer).
 */
export async function envoyerSignalement(s: Signalement, deps: HubSupportDeps = {}): Promise<EnvoiSignalementResult> {
  const r = await poster(
    "/api/support/service",
    {
      integration: INTEGRATION,
      appId: APP_CIBLE,
      type: s.sorte,
      external_key: s.external_key,
      reporterEmail: s.reporterEmail,
      title: s.title,
      message: s.message,
      images: s.images,
      tacheReliee: s.tacheReliee,
      [OBJET_DE_LA_SORTE[s.sorte]]: s.objet,
    },
    "signalement",
    deps
  );
  if (!r.ok) return r;
  return { ok: true, id: typeof r.j.id === "string" ? r.j.id : undefined, created: r.j.created !== false, status: r.status };
}

/**
 * Ferme le signalement d'une demande annulée dans Marketing Bleuh (le hub le
 * passe à RESOLVED avec la mention « Demande annulée par … »). Un signalement
 * déjà résolu reste tel quel : `annule:false`. Ne lève JAMAIS.
 */
export async function annulerSignalement(
  externalKey: string,
  par: string,
  deps: HubSupportDeps = {}
): Promise<AnnulationResult> {
  const r = await poster(
    "/api/support/service/annuler",
    { integration: INTEGRATION, external_key: externalKey, par },
    "annulation",
    deps
  );
  if (!r.ok) return r;
  return { ok: true, id: typeof r.j.id === "string" ? r.j.id : undefined, annule: r.j.annule === true, status: r.status };
}

/** L'ID Firestore de Marketing Bleuh dans `apps` — même source que fils-store.ts (`GESTIONSITEBLEUH_APP_ID`), sans l'importer. */
function appIdFirestore(): string {
  return (process.env.GESTIONSITEBLEUH_APP_ID || "").trim();
}

export interface SuppressionDiscussionResult {
  ok: boolean;
  /** `false` quand la discussion n'existait déjà plus (rien à effacer). */
  supprime?: boolean;
  status?: number;
  error?: string;
}

/**
 * Efface la discussion GANDALF (`app_fils`) d'une page ou d'une campagne
 * supprimée (CONTRAT v2 §3) — `POST /api/fils/service/supprimer`, MÊME clé
 * que les signalements.
 *
 * TOUJOURS appelée APRÈS une suppression déjà réussie (brouillon MailerLite,
 * fiche de page) : BEST-EFFORT, ne lève JAMAIS, et un refus ou une panne du
 * hub ne doit jamais défaire ni retarder la suppression déjà faite — chaque
 * appelant journalise `error` et continue.
 */
export async function supprimerDiscussion(
  espace: EspaceFil,
  objet: string,
  deps: HubSupportDeps = {}
): Promise<SuppressionDiscussionResult> {
  const r = await poster(
    "/api/fils/service/supprimer",
    { appId: appIdFirestore(), espace, objet },
    "suppression de discussion",
    deps
  );
  if (!r.ok) return r;
  return { ok: true, supprime: r.j.supprime === true, status: r.status };
}
