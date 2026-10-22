/**
 * LES PAGES D'ATTERRISSAGE DE BLEUH.CO — leur fiche, leurs états, leurs
 * phrases de dates, leur zone, et la validation d'écriture de Marketing Bleuh.
 *
 * Plan « Pages d'atterrissage et infolettres » (22/10/2026), lot L10.
 * Porté de marketing-mdh/src/lib/atterrissages-pure.ts, avec trois
 * différences qui tiennent à Bleuh :
 *   - une ZONE (`zones`) : Québec, Canada, ou les deux. La page ne s'ouvre
 *     que dans sa zone (`ouverteDansLaZone`) ;
 *   - des LANGUES (`langues`) : français et anglais, ou français seulement ;
 *   - PAS D'OFFRE : bleuh.co ne vend rien (ni prix, ni lot, ni code).
 *
 * ⚠ MODULE PARTAGÉ AVEC bleuh.co (lot L11) : site-bleuh/src/lib/
 * atterrissages-pure.ts en sera la COPIE CONFORME, cas de test compris
 * (`test/atterrissages.test.ts`). C'est pourquoi ce fichier n'importe RIEN.
 * Un changement d'un côté (état, phrase, zone, borne d'heure d'été) doit être
 * reporté de l'autre : la fiche que Daphnée voit dans Marketing Bleuh et la
 * page que voit le visiteur ne doivent JAMAIS dire deux choses différentes.
 *
 * QUI ÉCRIT, QUI LIT. Une fiche par page dans `bleuh_site_atterrissages`,
 * identifiée par son adresse française. Marketing Bleuh est le SEUL à écrire ;
 * le site ne fait que lire.
 *
 * LES DATES SONT DES JOURS, à l'heure de Montréal (America/Toronto) : la page
 * s'ouvre à minuit le jour du début, et le jour de la fin compte en entier,
 * jusqu'à 23 h 59 min 59 s. La section « écriture » (à partir de
 * `ATTERRISSAGE_ALLOWED_FIELDS`) ne sert qu'à Marketing Bleuh.
 */

export type Locale = "fr" | "en";

export interface Bilingual {
  fr: string;
  en: string;
}

/** Résultat d'une validation : la valeur propre, ou le message pour l'écran. */
export type Validated<T> = { ok: true; value: T } | { ok: false; error: string };

/** La collection Firestore des fiches — écrite par Marketing Bleuh, lue par bleuh.co. */
export const COLLECTION_ATTERRISSAGES = "bleuh_site_atterrissages";

export type Visibilite = "publique" | "privee";

/**
 * Ce que la page fait après sa fin, ou quand on l'éteint :
 *  - `terminee` : la page reste et dit que c'est fini, à sa façon ;
 *  - `renvoi`   : elle renvoie vers une autre page du site (`renvoi`) ;
 *  - `retiree`  : elle disparaît (« Page non trouvée »).
 */
export type ApresFin = "terminee" | "renvoi" | "retiree";

/**
 * Les zones de bleuh.co — celles du cookie `bleuh_region` du site : `qc` le
 * Québec, `ca` le reste du Canada (le « site Canada » n'est PAS le Québec).
 */
export type Zone = "qc" | "ca";
export const ZONES: readonly Zone[] = ["qc", "ca"];

export type Langue = "fr" | "en";

/** La demande d'origine — écrite par Marketing Bleuh, jamais lue par le site. */
export interface DemandeDeLaPage {
  ticket: string | null;
  tache: string | null;
  par: string | null;
  le: string | null;
}

export interface FicheAtterrissage {
  /** L'adresse française, sans barres : `bleuh-original-quebec`. Stable. */
  id: string;
  nom: string;
  /**
   * Les deux adresses, sans barres ni préfixe de langue. L'adresse anglaise
   * est vide quand la page est en français seulement.
   */
  adresse: Bilingual;
  /** Toujours au moins une zone, dans l'ordre `qc`, `ca`. */
  zones: Zone[];
  /** `["fr", "en"]` ou `["fr"]`. */
  langues: Langue[];
  /** L'interrupteur, indépendant des dates. Une page naît éteinte. */
  active: boolean;
  /**
   * Posé par Marketing Bleuh quand le signalement « Page » est réglé : la page
   * est dans le code du site. Tant qu'il est faux, la page est « en
   * préparation » et l'interrupteur reste grisé.
   */
  livree: boolean;
  debut: string | null;
  /** `null` : sans date de fin. */
  fin: string | null;
  /** HORS PRODUCTION SEULEMENT, la page s'ouvre dès ce jour (voir `etatDeLaPage`). */
  apercu: string | null;
  visibilite: Visibilite;
  apres: ApresFin;
  /** Chemin interne (`/produits`), quand `apres === "renvoi"`. */
  renvoi: string | null;
  /** Identifiants `products` (slug français) que la page présente. */
  produits: string[];
  demande: DemandeDeLaPage | null;
  /** Note libre, interne à Marketing Bleuh. Jamais lue par le site. */
  note?: string;
}

// ─────────────────────────────────────────────────────────────
// Lecture — ce que bleuh.co lit aussi.
// ─────────────────────────────────────────────────────────────

const JOUR = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Un vrai jour `AAAA-MM-JJ` (pas de 31 février), ou `null`. */
export function jourValide(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const m = JOUR.exec(v);
  if (!m) return null;
  const [a, mo, j] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(Date.UTC(a, mo - 1, j));
  return d.getUTCFullYear() === a && d.getUTCMonth() === mo - 1 && d.getUTCDate() === j ? v : null;
}

/**
 * Un chemin INTERNE du site : `/…`, jamais `//hote` (qui partirait ailleurs),
 * ni barre oblique inverse, ni espace, ni protocole.
 */
export function cheminInterne(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const c = v.trim();
  if (!c.startsWith("/") || c.startsWith("//") || /[\\\s]/.test(c) || /^\/[a-z]+:/i.test(c)) return null;
  return c;
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Une adresse de page : minuscules, chiffres et tirets — `bleuh-original-quebec`. */
export function adresseValide(v: unknown): string | null {
  return typeof v === "string" && SLUG.test(v) ? v : null;
}

/**
 * Les zones lues d'une valeur brute, dans l'ordre `qc`, `ca`, sans doublon ;
 * `null` si la liste est vide ou porte une zone inconnue.
 */
export function zonesValides(v: unknown): Zone[] | null {
  if (!Array.isArray(v) || v.length === 0) return null;
  if (!v.every((z) => z === "qc" || z === "ca")) return null;
  return ZONES.filter((z) => v.includes(z));
}

const texteOuVide = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/**
 * Lit une fiche telle que Firestore la rend, STRICTEMENT : ce qui ne se lit
 * pas n'est pas deviné.
 *
 * - Une date illisible, ou une fin avant le début, rend la fiche ENTIÈRE
 *   illisible (`null`) : la page ne s'ouvre pas.
 * - Une zone absente ou inconnue aussi : une page qui ne sait pas où elle
 *   vit ne s'ouvre nulle part, plutôt que partout.
 * - Une visibilité inconnue vaut « privée » : dans le doute, hors de Google.
 * - Un « après la fin » inconnu vaut « terminée » ; un renvoi sans chemin
 *   interne valable vaut « retirée ».
 * - Un aperçu après le début ne sert à rien : il est ignoré.
 * - Les langues : `["fr"]` seulement si la fiche le dit, ou si son adresse
 *   anglaise est vide ; une page en français seulement n'a pas d'adresse
 *   anglaise.
 */
export function lireFiche(id: string, brut: unknown): FicheAtterrissage | null {
  if (!adresseValide(id) || !brut || typeof brut !== "object") return null;
  const d = brut as Record<string, unknown>;

  for (const v of [d.debut, d.fin, d.apercu]) {
    if (v !== undefined && v !== null && v !== "" && jourValide(v) === null) return null;
  }
  const debut = jourValide(d.debut);
  const fin = jourValide(d.fin);
  let apercu = jourValide(d.apercu);
  if (debut && fin && fin < debut) return null;
  if (apercu && debut && apercu > debut) apercu = null;

  const zones = zonesValides(d.zones);
  if (!zones) return null;

  const adresseBrute = (d.adresse ?? {}) as Record<string, unknown>;
  const adresseFr = adresseValide(adresseBrute.fr) ?? id;
  const francaisSeulement =
    (Array.isArray(d.langues) && !d.langues.includes("en")) || adresseBrute.en === "";
  const adresseEn = francaisSeulement ? "" : (adresseValide(adresseBrute.en) ?? adresseFr);

  const apresBrut = d.apres;
  let apres: ApresFin = apresBrut === "renvoi" || apresBrut === "retiree" ? apresBrut : "terminee";
  const renvoi = cheminInterne(d.renvoi);
  if (apres === "renvoi" && !renvoi) apres = "retiree";

  const demandeBrute = d.demande as Record<string, unknown> | null | undefined;
  const demande: DemandeDeLaPage | null =
    demandeBrute && typeof demandeBrute === "object"
      ? {
          ticket: texteOuVide(demandeBrute.ticket) || null,
          tache: texteOuVide(demandeBrute.tache) || null,
          par: texteOuVide(demandeBrute.par) || null,
          le: texteOuVide(demandeBrute.le) || null,
        }
      : null;

  return {
    id,
    nom: texteOuVide(d.nom) || id,
    adresse: { fr: adresseFr, en: adresseEn },
    zones,
    langues: francaisSeulement ? ["fr"] : ["fr", "en"],
    active: d.active === true,
    livree: d.livree === true,
    debut,
    fin,
    apercu,
    visibilite: d.visibilite === "publique" ? "publique" : "privee",
    apres,
    renvoi: apres === "renvoi" ? renvoi : null,
    produits: Array.isArray(d.produits) ? d.produits.filter((p): p is string => typeof p === "string" && p !== "") : [],
    demande,
    ...(texteOuVide(d.note) ? { note: texteOuVide(d.note) } : {}),
  };
}

/** La page s'ouvre-t-elle pour un visiteur de cette zone ? Hors zone : renvoi à l'accueil. */
export function ouverteDansLaZone(fiche: Pick<FicheAtterrissage, "zones">, zone: Zone): boolean {
  return fiche.zones.includes(zone);
}

/** L'adresse de la page dans une langue, `null` si elle n'existe pas dans cette langue. */
export function adresseDansLaLangue(fiche: Pick<FicheAtterrissage, "adresse" | "langues">, locale: Locale): string | null {
  if (!fiche.langues.includes(locale)) return null;
  return fiche.adresse[locale] || null;
}

/**
 * Les six états d'une page :
 *  - `preparation` : la demande est partie, la page n'est pas livrée ;
 *  - `prete`       : livrée, mais éteinte avant son début, ou sans début ;
 *  - `programmee`  : allumée, avec un début à venir ;
 *  - `en-ligne`    : allumée, entre le début et la fin ;
 *  - `terminee`    : le lendemain de la fin ;
 *  - `eteinte`     : quelqu'un a coupé l'interrupteur après le début.
 */
export type EtatPage = "preparation" | "prete" | "programmee" | "en-ligne" | "terminee" | "eteinte";

/** L'heure de Montréal — celle des dates de toutes les fiches. */
export const FUSEAU_COMMERCANT = "America/Toronto";

/** Décalage du fuseau à cet instant — il change deux fois l'an. */
function decalageCommercantMs(instant: number): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSEAU_COMMERCANT,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instant));
  const v = (type: string): number => Number(parts.find((p) => p.type === type)?.value ?? "0");
  const commeUtc = Date.UTC(v("year"), v("month") - 1, v("day"), v("hour") % 24, v("minute"), v("second"));
  return commeUtc - Math.floor(instant / 1000) * 1000;
}

/** Dernière milliseconde du jour `AAAA-MM-JJ` à Montréal. */
export function finDeJourneeCommercantMs(jour: string): number {
  const [y, m, d] = jour.split("-").map(Number);
  const local = Date.UTC(y, m - 1, d, 23, 59, 59, 999);
  const premier = decalageCommercantMs(local);
  const candidat = local - premier;
  const second = decalageCommercantMs(candidat);
  return second === premier ? candidat : local - second;
}

/** Première milliseconde du jour `AAAA-MM-JJ` à Montréal — la veille finit, celui-ci commence. */
export function debutDeJourneeCommercantMs(jour: string): number {
  const [y, m, d] = jour.split("-").map(Number);
  const veille = new Date(Date.UTC(y, m - 1, d) - 86_400_000).toISOString().slice(0, 10);
  return finDeJourneeCommercantMs(veille) + 1;
}

/**
 * Le jour où la page s'ouvre sur CE service : son début, ou HORS PRODUCTION
 * son aperçu s'il vient avant.
 */
export function debutEffectif(fiche: Pick<FicheAtterrissage, "debut" | "apercu">, production: boolean): string | null {
  if (!fiche.debut) return null;
  return !production && fiche.apercu && fiche.apercu < fiche.debut ? fiche.apercu : fiche.debut;
}

/**
 * Où en est la page à cet instant, sur ce service. `production` : bleuh.co ;
 * ailleurs (préprod, poste local), l'aperçu compte.
 *
 * Marketing Bleuh appelle TOUJOURS cette fonction avec `production = true` :
 * ce qu'elle montre est ce que voit le visiteur en ce moment.
 *
 * Éteindre une page AVANT son début la rend « prête » (personne ne l'a vue),
 * APRÈS son début la rend « éteinte » (elle fait ce que dit « après la fin »).
 */
export function etatDeLaPage(fiche: FicheAtterrissage, maintenantMs: number, production: boolean): EtatPage {
  if (!fiche.livree) return "preparation";
  const debut = debutEffectif(fiche, production);
  if (!debut) return "prete";
  if (maintenantMs < debutDeJourneeCommercantMs(debut)) return fiche.active ? "programmee" : "prete";
  if (!fiche.active) return "eteinte";
  if (fiche.fin && maintenantMs > finDeJourneeCommercantMs(fiche.fin)) return "terminee";
  return "en-ligne";
}

/**
 * Où renvoie une page finie, dans la langue de la page : le chemin de la
 * fiche, préfixé de la langue (`/fr/produits`, `/en/produits`) — bleuh.co
 * préfixe toutes ses adresses. `null` sans renvoi.
 */
export function cheminDeRenvoi(fiche: Pick<FicheAtterrissage, "apres" | "renvoi">, locale: Locale): string | null {
  if (fiche.apres !== "renvoi" || !fiche.renvoi) return null;
  return `/${locale}${fiche.renvoi === "/" ? "" : fiche.renvoi}`;
}

// ─────────────────────────────────────────────────────────────
// Les dates en toutes lettres. Jours `AAAA-MM-JJ`, jamais l'horloge : la
// même date s'écrit pareil au serveur, au navigateur et dans les tests.
// ─────────────────────────────────────────────────────────────

export const MOIS: Record<Locale, readonly string[]> = {
  fr: ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
};

/** « 1er », puis « 2 », « 3 »… — l'ordinal du premier du mois, en français. */
export const jourFr = (j: number): string => `${j}${j === 1 ? "er" : ""}`;

const parties = (jour: string): [number, number, number] => {
  const [a, m, j] = jour.split("-").map(Number);
  return [a, m, j];
};

function unSeulJour(jour: string, locale: Locale, annee: boolean): string {
  const [a, m, j] = parties(jour);
  if (locale === "fr") return `Le ${jourFr(j)} ${MOIS.fr[m - 1]}${annee ? ` ${a}` : ""}`;
  return `${MOIS.en[m - 1]} ${j}${annee ? `, ${a}` : ""}`;
}

/** `2026-10-22` → « 22 octobre 2026 » / « October 22, 2026 ». */
export function dateLongue(jour: string, locale: Locale): string {
  const [a, m, j] = parties(jour);
  const mois = MOIS[locale][m - 1] ?? "";
  return locale === "fr" ? `${jourFr(j)} ${mois} ${a}` : `${mois} ${j}, ${a}`;
}

/** « Du 8 au 22 octobre » / « October 8–22 » : sans l'année, le mois une seule fois s'il ne change pas. */
export function periodeCourte(debut: string, fin: string, locale: Locale): string {
  if (debut === fin) return unSeulJour(debut, locale, false);
  const [a1, m1, j1] = parties(debut);
  const [a2, m2, j2] = parties(fin);
  const mois = MOIS[locale];
  const annees = a1 !== a2;
  if (locale === "fr") {
    const f = `${jourFr(j2)} ${mois[m2 - 1]}${annees ? ` ${a2}` : ""}`;
    if (!annees && m1 === m2) return `Du ${jourFr(j1)} au ${f}`;
    return `Du ${jourFr(j1)} ${mois[m1 - 1]}${annees ? ` ${a1}` : ""} au ${f}`;
  }
  if (!annees && m1 === m2) return `${mois[m1 - 1]} ${j1}–${j2}`;
  const d = `${mois[m1 - 1]} ${j1}${annees ? `, ${a1}` : ""}`;
  return `${d} – ${mois[m2 - 1]} ${j2}${annees ? `, ${a2}` : ""}`;
}

/** « Du 8 au 22 octobre 2026 » / « October 8–22, 2026 » : la forme courte, plus l'année. */
export function periodeDuHeros(debut: string, fin: string, locale: Locale): string {
  const courte = periodeCourte(debut, fin, locale);
  const annee = fin.slice(0, 4);
  if (debut.slice(0, 4) !== annee) return courte;
  return locale === "fr" ? `${courte} ${annee}` : `${courte}, ${annee}`;
}

/** La période DANS une phrase, sans l'année : « du 8 au 22 octobre » / « from October 8 to 22 ». */
export function periodeEnPhrase(debut: string, fin: string, locale: Locale): string {
  if (debut === fin) {
    const [, m, j] = parties(debut);
    return locale === "fr" ? `le ${jourFr(j)} ${MOIS.fr[m - 1]}` : `on ${MOIS.en[m - 1]} ${j}`;
  }
  const [a1, m1, j1] = parties(debut);
  const [a2, m2, j2] = parties(fin);
  const mois = MOIS[locale];
  const annees = a1 !== a2;
  if (locale === "fr") {
    const f = `${jourFr(j2)} ${mois[m2 - 1]}${annees ? ` ${a2}` : ""}`;
    if (!annees && m1 === m2) return `du ${jourFr(j1)} au ${f}`;
    return `du ${jourFr(j1)} ${mois[m1 - 1]}${annees ? ` ${a1}` : ""} au ${f}`;
  }
  if (!annees && m1 === m2) return `from ${mois[m1 - 1]} ${j1} to ${j2}`;
  const d = `${mois[m1 - 1]} ${j1}${annees ? `, ${a1}` : ""}`;
  return `from ${d} to ${mois[m2 - 1]} ${j2}${annees ? `, ${a2}` : ""}`;
}

/** « dès le 5 novembre » / « from November 5 » — sans l'année, dans une phrase. */
export function desLeEnPhrase(debut: string, locale: Locale): string {
  const [, m, j] = parties(debut);
  const mois = MOIS[locale][m - 1] ?? "";
  return locale === "fr" ? `dès le ${jourFr(j)} ${mois}` : `from ${mois} ${j}`;
}

/** « Dès le 5 novembre 2026 » / « From November 5, 2026 » — une période sans fin. */
export function desLe(debut: string, locale: Locale): string {
  return locale === "fr" ? `Dès le ${dateLongue(debut, locale)}` : `From ${dateLongue(debut, locale)}`;
}

/**
 * Les phrases de dates que la page affiche, calculées depuis sa fiche :
 *  - `periode` : « Du 8 au 22 octobre 2026 » ; sans fin, « Dès le 5 novembre 2026 » ;
 *  - `debut`   : « 8 octobre 2026 » ;
 *  - `fin`     : « 22 octobre 2026 » (vide sans fin) ;
 *  - `du_au`   : dans une phrase, sans l'année — « du 8 au 22 octobre ».
 */
export interface PhrasesDeLaPage {
  periode: string;
  debut: string;
  fin: string;
  du_au: string;
}

export function phrasesDeLaPage(fiche: Pick<FicheAtterrissage, "debut" | "fin">, locale: Locale): PhrasesDeLaPage {
  const { debut, fin } = fiche;
  if (!debut) return { periode: "", debut: "", fin: "", du_au: "" };
  if (!fin) {
    return { periode: desLe(debut, locale), debut: dateLongue(debut, locale), fin: "", du_au: desLeEnPhrase(debut, locale) };
  }
  return {
    periode: periodeDuHeros(debut, fin, locale),
    debut: dateLongue(debut, locale),
    fin: dateLongue(fin, locale),
    du_au: periodeEnPhrase(debut, fin, locale),
  };
}

/** Remplace `{cle}` par sa valeur. Un repère inconnu devient vide. */
export const remplir = (gabarit: string, valeurs: Record<string, string>): string =>
  gabarit.replace(/\{(\w+)\}/g, (_, cle: string) => valeurs[cle] ?? "");

/** Les phrases comme valeurs de `remplir` : `{periode}`, `{debut}`, `{fin}`, `{du_au}`. */
export function valeursDesPhrases(p: PhrasesDeLaPage): Record<string, string> {
  return { periode: p.periode, debut: p.debut, fin: p.fin, du_au: p.du_au };
}

// ─────────────────────────────────────────────────────────────
// ÉCRITURE — propre à Marketing Bleuh (le site ne modifie jamais une fiche).
// Liste blanche stricte : un champ inconnu est REFUSÉ plutôt qu'ignoré ; la
// fenêtre de dates est vérifiée sur l'état RÉSULTANT (fiche + patch).
// ─────────────────────────────────────────────────────────────

/** Champs modifiables par `PATCH /api/site/atterrissages/[id]`. */
export const ATTERRISSAGE_ALLOWED_FIELDS = ["active", "debut", "fin", "apercu", "visibilite", "apres", "renvoi", "zones"] as const;

export interface EntreeAtterrissagePatch {
  active?: boolean;
  debut?: string | null;
  fin?: string | null;
  apercu?: string | null;
  visibilite?: Visibilite;
  apres?: ApresFin;
  renvoi?: string | null;
  zones?: Zone[];
}

/** Date `AAAA-MM-JJ` ou `null`, avec un message d'erreur qui nomme le champ. */
export function validerJourOuNull(input: unknown, champ: string): Validated<string | null> {
  if (input === null || input === undefined || input === "") return { ok: true, value: null };
  const v = jourValide(input);
  if (v === null) return { ok: false, error: `${champ} : date attendue au format AAAA-MM-JJ.` };
  return { ok: true, value: v };
}

/**
 * La fenêtre se tient, sur l'état RÉSULTANT : la fin le jour du début ou
 * après ; l'aperçu au plus tard le jour du début.
 */
export function validerFenetreAtterrissage(debut: string | null, fin: string | null, apercu: string | null): Validated<true> {
  if (debut && fin && fin < debut) {
    return { ok: false, error: "La date de fin est antérieure à la date de début." };
  }
  if (debut && apercu && apercu > debut) {
    return { ok: false, error: "L'aperçu pour l'équipe doit être au plus tard le jour du début." };
  }
  return { ok: true, value: true };
}

/**
 * Valide un PATCH de fiche : seuls les champs présents sont contrôlés, et
 * seuls ceux de la liste blanche sont retenus. `renvoi` suit `apres` : choisir
 * « Renvoyer vers une autre page » sans chemin est refusé ; choisir un autre
 * « après la fin » efface le renvoi enregistré.
 */
export function validerPatchAtterrissage(
  src: Record<string, unknown>,
  actuel: Pick<FicheAtterrissage, "debut" | "fin" | "apercu" | "apres" | "renvoi">
): Validated<EntreeAtterrissagePatch> {
  const inconnus = Object.keys(src).filter((k) => !(ATTERRISSAGE_ALLOWED_FIELDS as readonly string[]).includes(k));
  if (inconnus.length > 0) {
    return { ok: false, error: `Champ non modifiable : ${inconnus.join(", ")}.` };
  }

  const out: EntreeAtterrissagePatch = {};

  if ("active" in src) {
    if (typeof src.active !== "boolean") {
      return { ok: false, error: "« Activée » : une case à cocher est attendue (vrai ou faux)." };
    }
    out.active = src.active;
  }

  let debut = actuel.debut;
  if ("debut" in src) {
    const r = validerJourOuNull(src.debut, "Début");
    if (!r.ok) return r;
    out.debut = r.value;
    debut = r.value;
  }

  let fin = actuel.fin;
  if ("fin" in src) {
    const r = validerJourOuNull(src.fin, "Fin");
    if (!r.ok) return r;
    out.fin = r.value;
    fin = r.value;
  }

  let apercu = actuel.apercu;
  if ("apercu" in src) {
    const r = validerJourOuNull(src.apercu, "Aperçu pour l'équipe");
    if (!r.ok) return r;
    out.apercu = r.value;
    apercu = r.value;
  }

  const fenetre = validerFenetreAtterrissage(debut, fin, apercu);
  if (!fenetre.ok) return fenetre;

  if ("visibilite" in src) {
    if (src.visibilite !== "publique" && src.visibilite !== "privee") {
      return { ok: false, error: "Visibilité « " + String(src.visibilite) + " » inconnue : publique ou privée." };
    }
    out.visibilite = src.visibilite;
  }

  if ("zones" in src) {
    const z = zonesValides(src.zones);
    if (!z) return { ok: false, error: "Zone : Québec, Canada, ou les deux." };
    out.zones = z;
  }

  let apres = actuel.apres;
  let renvoiRetenu = actuel.renvoi;
  let renvoiTouche = false;
  if ("apres" in src) {
    if (src.apres !== "terminee" && src.apres !== "renvoi" && src.apres !== "retiree") {
      return { ok: false, error: "« Après la fin » : terminée, renvoi ou retirée." };
    }
    apres = src.apres;
    out.apres = apres;
  }
  if ("renvoi" in src) {
    renvoiTouche = true;
    if (src.renvoi === null || src.renvoi === "") {
      renvoiRetenu = null;
    } else {
      const r = cheminInterne(src.renvoi);
      if (!r) {
        return { ok: false, error: "Le renvoi doit être un chemin interne du site, sans la langue (ex. /produits)." };
      }
      renvoiRetenu = r;
    }
  }
  if (apres === "renvoi") {
    if (!renvoiRetenu) {
      return {
        ok: false,
        error: "Un renvoi vers une autre page est obligatoire : indiquez son chemin interne, sans la langue (ex. /produits).",
      };
    }
    if (renvoiTouche) out.renvoi = renvoiRetenu;
  } else if ("apres" in src) {
    out.renvoi = null;
  }

  if (Object.keys(out).length === 0) {
    return { ok: false, error: "Aucun champ à modifier." };
  }
  return { ok: true, value: out };
}
