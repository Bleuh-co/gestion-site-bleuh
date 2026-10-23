/**
 * LA DISCUSSION D'UNE PAGE OU D'UNE INFOLETTRE — côté Marketing Bleuh (porté de marketing-mdh, lot L10).
 *
 * Plan « Pages d'atterrissage et infolettres » (22/10/2026), D1 = a : la
 * discussion vit dans GANDALF (`app_fils`, hub-chanv routes/fils.js) et
 * s'ouvre à droite de l'app, dans le volet d'une tâche. L'app n'affiche que
 * la colonne « Commentaires » et le bouton « Discussion » ; elle LIT
 * `app_fils` (même base) et n'y écrit jamais.
 *
 * Deux règles sont recopiées de hub-chanv lib/fil-messages.js — l'app
 * n'importe pas le hub — et testées aux mêmes valeurs
 * (test/fils-discussion.test.ts) :
 *   • `filIdDe` : filId = <appId>__<espace>__<objet>, déterministe ;
 *   • `etatPourMoi` : { compte, nouveau } pour la personne connectée.
 *
 * Le reste est le protocole de la coquille (hub-chanv public/js/shell.js) :
 *   app → coquille  {type:'gandalf:fil', espace, objet, titre, resume, chemin, marque, ajustable?}
 *   coquille → app  {type:'gandalf:fil-maj', espace, objet, filId, compte, nouveau:false, ouvert?}
 *   coquille → app  {type:'gandalf:fil-ferme', espace, objet, filId}
 * L'appId n'est jamais dans le message : la coquille le tire de l'iframe.
 *
 * CONTRAT v2 (plan « Pages d'atterrissage et infolettres », 22/10/2026) :
 *   §1 `ajustable` — pages seulement (une campagne MailerLite n'a pas de
 *      circuit d'équipe) : vrai quand la fiche n'est pas « En préparation ».
 *      Absent du message si non défini — jamais envoyé à `false` implicite.
 *   §2 la rangée active — `ouvert:true` sur `gandalf:fil-maj` confirme que le
 *      volet est ouvert sur cet objet ; `gandalf:fil-ferme` l'efface. Voir
 *      `useFilActif` (fils-client.ts).
 */

export const ESPACES_FIL = ["pages", "infolettres"] as const;
export type EspaceFil = (typeof ESPACES_FIL)[number];

/** Ce que montre la cellule « Commentaires ». `filId` vide = pas de discussion possible (appId inconnu, objet invalide). */
export interface EtatFil {
  filId: string;
  compte: number;
  nouveau: boolean;
}

export const ETAT_FIL_VIDE: EtatFil = Object.freeze({ filId: "", compte: 0, nouveau: false }) as EtatFil;

const APP_ID_RE = /^[a-z0-9](?:[a-z0-9-]|_(?!_))*$/i;
const OBJET_RE = /^[A-Za-z0-9._~-]+$/;
const MAX_ID = 300;

/** Jumeau de hub-chanv lib/fil-messages.js `filIdDe` : { appId, espace, objet } → filId, ou "" si une pièce est invalide. */
export function filIdDe({ appId, espace, objet }: { appId: string; espace: string; objet: string }): string {
  const a = String(appId ?? "").trim();
  const e = String(espace ?? "").trim();
  const o = String(objet ?? "").trim();
  if (!a || a.length > 80 || !APP_ID_RE.test(a)) return "";
  if (!(ESPACES_FIL as readonly string[]).includes(e)) return "";
  if (!o || o.length > 200 || !OBJET_RE.test(o) || o === "." || o === "..") return "";
  const id = `${a}__${e}__${o}`;
  return id.length > MAX_ID ? "" : id;
}

/** Un horodatage Firestore (Timestamp, Date, chaîne ISO) → millisecondes, ou NaN. */
function ms(v: unknown): number {
  if (!v) return NaN;
  if (typeof v === "string") return Date.parse(v);
  if (v instanceof Date) return v.getTime();
  const ts = v as { toDate?: () => Date };
  if (typeof ts.toDate === "function") {
    try {
      return ts.toDate().getTime();
    } catch {
      return NaN;
    }
  }
  return NaN;
}

/**
 * Jumeau de hub-chanv lib/fil-messages.js `etatPourMoi`. `nouveau` = un
 * message est arrivé depuis la dernière ouverture du volet par cette
 * personne, et il n'est pas d'elle.
 */
export function etatPourMoi(fil: unknown, email: string): { compte: number; nouveau: boolean } {
  const f = (fil && typeof fil === "object" ? fil : {}) as Record<string, unknown>;
  const compte = typeof f.compte === "number" && Number.isFinite(f.compte) && f.compte > 0 ? f.compte : 0;
  const moi = String(email ?? "").toLowerCase();
  const dernier = (f.dernier && typeof f.dernier === "object" ? f.dernier : {}) as Record<string, unknown>;
  const le = ms(dernier.le);
  if (!compte || !Number.isFinite(le) || String(dernier.par ?? "").toLowerCase() === moi) return { compte, nouveau: false };
  const vuPar = (f.vu_par && typeof f.vu_par === "object" ? f.vu_par : {}) as Record<string, unknown>;
  const vu = ms(vuPar[moi]);
  return { compte, nouveau: !Number.isFinite(vu) || le > vu };
}

/** Le résumé posé en tête du volet (hub-chanv `nettoyerResume` en fixe les plafonds). */
export interface ResumeFil {
  contexte?: string;
  etat?: string;
  lignes?: { libelle: string; valeur: string }[];
  /**
   * Un chemin de l'app (rouvert dans son cadre par la coquille) OU une adresse
   * https, ouverte dans un nouvel onglet (« Voir sur la préprod » — écrans §3
   * du plan ; hub-chanv nettoyerResume).
   */
  liens?: ({ libelle: string; chemin: string } | { libelle: string; url: string })[];
}

export interface OuvertureFil {
  espace: EspaceFil;
  objet: string;
  titre: string;
  resume?: ResumeFil;
  /** Où rouvrir l'app depuis une mention (chemin de l'app, commence par « / »). */
  chemin: string;
  /**
   * CONTRAT v2 §1 : la fiche n'est pas « En préparation » (aucune demande en
   * cours). Pages seulement — une campagne MailerLite ne doit JAMAIS porter
   * ce champ (pas de circuit d'équipe pour elles) : laisser `undefined`.
   */
  ajustable?: boolean;
}

/** Le message `gandalf:fil` que la coquille attend. `ajustable` n'y entre que s'il est défini (CONTRAT v2 §1). */
export function messageOuvertureFil(o: OuvertureFil): Record<string, unknown> {
  const message: Record<string, unknown> = {
    type: "gandalf:fil",
    espace: o.espace,
    objet: o.objet,
    titre: o.titre,
    resume: o.resume ?? {},
    chemin: o.chemin,
    marque: "bleuh",
  };
  if (o.ajustable !== undefined) message.ajustable = o.ajustable;
  return message;
}

/** L'adresse GANDALF qui ouvre la discussion hors de la coquille (l'app ouverte seule, dans un onglet). */
export function lienDiscussionHorsCoquille(hubUrl: string, filId: string): string {
  return `${hubUrl.replace(/\/+$/, "")}/?view=fil&fil=${encodeURIComponent(filId)}`;
}

/**
 * Un message reçu de la coquille → la mise à jour d'une cellule, ou `null`.
 * `filId` sert de clé : il porte l'appId, que l'app ne peut pas confondre.
 * `ouvert` (CONTRAT v2 §2) : vrai quand le volet est ouvert sur CET objet —
 * c'est la confirmation qui fait de cette rangée la rangée active.
 */
export function lireMajFil(data: unknown): { filId: string; espace: string; objet: string; compte: number; ouvert: boolean } | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  if (d.type !== "gandalf:fil-maj") return null;
  const compte = typeof d.compte === "number" && Number.isFinite(d.compte) && d.compte >= 0 ? Math.floor(d.compte) : null;
  if (compte === null || typeof d.filId !== "string" || !d.filId) return null;
  return { filId: d.filId, espace: String(d.espace ?? ""), objet: String(d.objet ?? ""), compte, ouvert: d.ouvert === true };
}

/**
 * `gandalf:fil-ferme` (CONTRAT v2 §2) : le volet vient de se fermer sur cet
 * objet — efface la rangée active si c'est elle qui l'était.
 */
export function lireFermetureFil(data: unknown): { filId: string; espace: string; objet: string } | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  if (d.type !== "gandalf:fil-ferme") return null;
  if (typeof d.filId !== "string" || !d.filId) return null;
  return { filId: d.filId, espace: String(d.espace ?? ""), objet: String(d.objet ?? "") };
}
