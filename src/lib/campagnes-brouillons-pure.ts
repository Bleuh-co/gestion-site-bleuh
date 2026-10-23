import type { OuvertureFil } from "./fils-pure";

/**
 * LES CAMPAGNES MAILERLITE BLEUH PAS ENCORE PARTIES — plan « Pages
 * d'atterrissage et infolettres » (22/10/2026), lot L12, D4 = b : les
 * infolettres de Bleuh restent composées dans MailerLite ; Marketing Bleuh
 * montre leurs brouillons et leurs envois programmés, leur discussion, un
 * lien vers MailerLite et la suppression d'un brouillon.
 *
 * Ce que renvoie l'API Classic v2 (relevé le 23/10 sur le compte Bleuh) :
 *   GET /campaigns/draft  → status « draft »,  date_send « -0001-11-30 00:00:00 »
 *   GET /campaigns/outbox → status « outbox », date_send = l'heure programmée
 * Les dates sont à l'heure du compte, sans fuseau : on les garde telles quelles.
 *
 * La discussion d'une campagne : espace « infolettres », objet = l'id
 * MailerLite. L'id ne change pas à l'envoi : la discussion suit la campagne
 * dans le tableau des campagnes envoyées.
 */

export type StatutNonEnvoyee = "brouillon" | "programmee";

export interface CampagneNonEnvoyee {
  id: string;
  name: string;
  subject: string;
  type: string; // "regular" | "ab" | …
  statut: StatutNonEnvoyee;
  dateCreated: string; // "YYYY-MM-DD HH:MM:SS"
  /** L'heure d'envoi prévue ; null pour un brouillon. */
  dateSend: string | null;
}

/** Un id de campagne MailerLite Classic : des chiffres, rien d'autre (il entre dans une URL de l'API). */
export function idCampagneValide(id: unknown): id is string {
  return typeof id === "string" && /^[0-9]{1,15}$/.test(id);
}

/** « -0001-11-30 00:00:00 » (pas de date), vide, ou une date illisible → null. */
function dateOuNull(v: unknown): string | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const s = v.trim();
  if (s.startsWith("-") || s.startsWith("0000")) return null;
  return Number.isNaN(Date.parse(s.replace(" ", "T"))) ? null : s;
}

/** Une ligne brute de /campaigns/draft ou /campaigns/outbox → notre forme, ou null si elle n'a pas d'id lisible. */
export function lireCampagneNonEnvoyee(raw: unknown, statut: StatutNonEnvoyee): CampagneNonEnvoyee | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Record<string, unknown>;
  const id = String(c.id ?? "");
  if (!idCampagneValide(id)) return null;
  return {
    id,
    name: typeof c.name === "string" ? c.name : "",
    subject: typeof c.subject === "string" ? c.subject : "",
    type: typeof c.type === "string" && c.type ? c.type : "regular",
    statut,
    dateCreated: typeof c.date_created === "string" ? c.date_created : "",
    dateSend: statut === "programmee" ? dateOuNull(c.date_send) : null,
  };
}

/**
 * L'ordre du tableau : les envois programmés d'abord, le plus proche en tête ;
 * puis les brouillons, le plus récent en tête.
 */
export function trierNonEnvoyees(list: CampagneNonEnvoyee[]): CampagneNonEnvoyee[] {
  return [...list].sort((a, b) => {
    if (a.statut !== b.statut) return a.statut === "programmee" ? -1 : 1;
    if (a.statut === "programmee") return (a.dateSend ?? "").localeCompare(b.dateSend ?? "");
    return b.dateCreated.localeCompare(a.dateCreated);
  });
}

/**
 * Où ouvrir la campagne dans MailerLite Classic. L'interface ne se lit
 * qu'une fois connecté : seule la liste par statut est une adresse sûre
 * (onglets « Drafts » et « Outbox »), on y retrouve la campagne par son nom.
 */
export function lienMailerLite(statut: StatutNonEnvoyee): string {
  return `https://app.mailerlite.com/campaigns/${statut === "programmee" ? "outbox" : "draft"}/`;
}

/** Le chemin qui rouvre l'onglet Campagnes sur cette campagne (depuis une mention). */
export function cheminCampagne(id: string): string {
  return `/infolettre?onglet=campagnes&campagne=${encodeURIComponent(id)}`;
}

export interface LibellesDiscussionCampagne {
  contexte: string; // « Infolettre Bleuh · MailerLite »
  etat: string; // « Brouillon », « Programmée », « Envoyée »
  objet: { libelle: string; valeur: string };
  date: { libelle: string; valeur: string };
  ouvrir: string; // « Ouvrir l'onglet Campagnes »
}

/** Ce que le volet de la discussion montre en tête pour une campagne. */
export function ouvertureFilCampagne(c: { id: string; name: string; subject: string }, l: LibellesDiscussionCampagne): OuvertureFil {
  const chemin = cheminCampagne(c.id);
  return {
    espace: "infolettres",
    objet: c.id,
    titre: c.name || c.subject || `Campagne ${c.id}`,
    chemin,
    resume: {
      contexte: l.contexte,
      etat: l.etat,
      lignes: [l.objet, l.date].filter((x) => x.valeur),
      liens: [{ libelle: l.ouvrir, chemin }],
    },
  };
}
