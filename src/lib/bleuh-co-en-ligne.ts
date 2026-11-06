import "server-only";
import { ErreurMetier } from "./erreur-metier";
import { cheminDeAdresse } from "./seo-reglages-pure";
import { lirePlanDuSite, lireTete, pagesDuPlan, type PageSeo, type TeteDePage } from "./seo-pages-pure";

/**
 * Ce que bleuh.co sert EN CE MOMENT, lu comme Google le lit : le plan du site
 * (la liste des pages) et l'en-tête de chaque page (titre, description, image
 * de partage). Sert à Titres et descriptions : un champ vide montre le texte
 * que la page affiche déjà, jamais un vide.
 *
 * COMME UN ROBOT. L'agent « BleuhSeoBot » est reconnu par bleuh.co comme un
 * robot (crawler-pure.ts) : pas de géolocalisation, pas de témoin, donc /fr en
 * version Québec et /en en version Canada — exactement ce que Google reçoit.
 *
 * TOUJOURS LE DOMAINE PUBLIC (`SITEBLEUH_PUBLIC_URL`, sinon https://bleuh.co),
 * jamais une adresse fournie par l'écran : on ne lit que des chemins /fr ou
 * /en validés par `cheminDeAdresse`. Les redirections ne sont pas suivies.
 */

const USER_AGENT = "BleuhSeoBot/1.0 (+gestion-site-bleuh)";
const DELAI_MS = 8_000;
const PLAN_TTL_MS = 10 * 60_000;
const TETE_TTL_MS = 3 * 60_000;
const EN_PARALLELE = 6;

export function baseBleuhCo(): string {
  return (process.env.SITEBLEUH_PUBLIC_URL || "https://bleuh.co").replace(/\/+$/, "");
}

async function lireTexte(url: string): Promise<{ statut: number; texte: string }> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xml" },
    redirect: "manual",
    cache: "no-store",
    signal: AbortSignal.timeout(DELAI_MS),
  });
  return { statut: res.status, texte: res.status === 200 ? await res.text() : "" };
}

let plan: { pages: PageSeo[]; luA: number } | null = null;

/** Les pages du plan du site de bleuh.co (10 min de cache ; la dernière liste lue survit à une panne). */
export async function pagesDeBleuhCo(): Promise<{ pages: PageSeo[]; luA: number }> {
  if (plan && Date.now() - plan.luA < PLAN_TTL_MS) return plan;
  try {
    const { statut, texte } = await lireTexte(`${baseBleuhCo()}/sitemap.xml`);
    if (statut !== 200) throw new Error(`HTTP ${statut}`);
    const pages = pagesDuPlan(lirePlanDuSite(texte));
    if (!pages.length) throw new Error("plan du site vide");
    plan = { pages, luA: Date.now() };
    return plan;
  } catch (e) {
    console.error("[titres-descriptions] plan du site illisible", e);
    if (plan) return plan;
    throw new ErreurMetier("Le plan du site de bleuh.co est illisible pour le moment. Réessayez dans une minute.", 502);
  }
}

export type TeteOk = TeteDePage & { statut: 200 };
export type TeteLue = TeteOk | { statut: number; erreur: string };

const tetes = new Map<string, { tete: TeteLue; luA: number }>();

async function lireUneTete(chemin: string, frais: boolean): Promise<TeteLue> {
  const enCache = tetes.get(chemin);
  if (!frais && enCache && Date.now() - enCache.luA < TETE_TTL_MS) return enCache.tete;
  let tete: TeteLue;
  try {
    const { statut, texte } = await lireTexte(`${baseBleuhCo()}${chemin}`);
    tete = statut === 200 ? { statut: 200, ...lireTete(texte) } : { statut, erreur: `HTTP ${statut}` };
  } catch (e) {
    tete = { statut: 0, erreur: e instanceof Error && e.name === "TimeoutError" ? "délai dépassé" : "injoignable" };
  }
  tetes.set(chemin, { tete, luA: Date.now() });
  return tete;
}

/**
 * L'en-tête en ligne de chaque chemin (3 min de cache, sauf `frais`). Les
 * chemins qui ne sont pas des pages /fr ou /en de bleuh.co sont ignorés.
 */
export async function tetesEnLigne(chemins: string[], frais = false): Promise<Record<string, TeteLue>> {
  const valides = [...new Set(chemins.map((c) => cheminDeAdresse(c)).filter((c): c is string => !!c))];
  const out: Record<string, TeteLue> = {};
  let i = 0;
  const ouvrier = async () => {
    while (i < valides.length) {
      const chemin = valides[i++];
      out[chemin] = await lireUneTete(chemin, frais);
    }
  };
  await Promise.all(Array.from({ length: Math.min(EN_PARALLELE, valides.length) }, ouvrier));
  return out;
}
