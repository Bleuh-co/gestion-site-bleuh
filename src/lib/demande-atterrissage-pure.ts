import {
  adresseValide,
  jourValide,
  validerFenetreAtterrissage,
  validerJourOuNull,
  zonesValides,
  type Langue,
  type Validated,
  type Visibilite,
  type Zone,
} from "./atterrissages-pure";

/**
 * « Demander une page », côté Bleuh — validation du formulaire et texte exact
 * du signalement envoyé au hub (plan « Pages d'atterrissage et infolettres »,
 * 22/10/2026, lot L10 ; maquette « Demander une page, côté Bleuh »).
 *
 * Porté de marketing-mdh/src/lib/demande-atterrissage-pure.ts. Ce qui change :
 *   - DEUX adresses, française et anglaise (bleuh.co préfixe la langue :
 *     bleuh.co/fr/<adresse>, bleuh.co/en/<adresse>) ;
 *   - la ZONE (Québec, Canada, les deux) et les LANGUES ;
 *   - AUCUNE offre : bleuh.co ne vend rien ;
 *   - la règle de fin de signalement est la règle Bleuh (barrière d'âge,
 *     aucun prix ni incitatif, français de Dany, anglais du guide de marque).
 *
 * Deux modes, un seul schéma : `decrire` ou `tache` (une tâche GANDALF déjà
 * trouvée par `taches-hub.ts`, qui porte elle-même la description).
 *
 * Ce module ne touche à AUCUNE base : l'adresse déjà prise, les produits
 * inconnus, la tâche introuvable se vérifient à l'API.
 */

/** Un champ facultatif vide s'écrit ainsi dans le signalement — jamais silencieusement tu. */
const AU_PRECISER = "à préciser";

/**
 * L'adresse proposée à partir du nom : minuscules sans accents, tirets, et
 * COURTE — au plus 40 caractères, coupée entre deux mots.
 */
export const ADRESSE_PROPOSEE_MAX = 40;

export function slugifier(nom: string): string {
  const complet = nom
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (complet.length <= ADRESSE_PROPOSEE_MAX) return complet;
  const coupe = complet.slice(0, ADRESSE_PROPOSEE_MAX + 1);
  const dernier = coupe.lastIndexOf("-");
  return (dernier > 0 ? coupe.slice(0, dernier) : complet.slice(0, ADRESSE_PROPOSEE_MAX)).replace(/-+$/g, "");
}

export interface EntreeDemande {
  mode: "decrire" | "tache";
  nom: string;
  adresseFr: string;
  /** Vide quand la page est en français seulement. */
  adresseEn: string;
  zones: Zone[];
  langues: Langue[];
  /** Ignoré en mode `tache` (le signalement dit alors « Voir la tâche reliée »). */
  aQuoiSert: string;
  aChanger: string;
  maquetteLien: string;
  /** URLs déjà téléversées par `/api/site/captures` — 5 au plus. */
  captures: string[];
  produits: string[];
  debut: string | null;
  fin: string | null;
  visibilite: Visibilite;
  pretePourLe: string | null;
  /** Identifiant de la tâche GANDALF reliée, mode `tache` seulement. */
  tacheId: string | null;
}

const texteCourt = (v: unknown, max: number): string => String(v ?? "").trim().slice(0, max);

/**
 * Valide le formulaire. Un champ hors forme est refusé ; un champ FACULTATIF
 * vide passe — le texte du signalement écrit « à préciser » à sa place.
 * L'offre n'existe pas ici : un `offreMode` envoyé quand même est refusé,
 * pour qu'aucun prix n'entre par un appel direct à l'API.
 */
export function validerDemande(src: Record<string, unknown>): Validated<EntreeDemande> {
  const mode = src.mode === "tache" ? ("tache" as const) : ("decrire" as const);

  if ("offreMode" in src || "offrePrecision" in src) {
    return { ok: false, error: "bleuh.co ne vend rien : une page Bleuh ne porte ni prix ni offre." };
  }

  const nom = texteCourt(src.nom, 120);
  if (!nom) return { ok: false, error: "Le nom de la page est requis." };

  const adresseFr = adresseValide(src.adresseFr);
  if (!adresseFr) {
    return { ok: false, error: "L'adresse française doit être en minuscules, chiffres et tirets (ex. preroules-bleuh-original)." };
  }

  const langues: Langue[] = src.langues === "fr" || (Array.isArray(src.langues) && !src.langues.includes("en")) ? ["fr"] : ["fr", "en"];
  let adresseEn = "";
  if (langues.includes("en")) {
    const en = adresseValide(src.adresseEn);
    if (!en) {
      return { ok: false, error: "L'adresse anglaise doit être en minuscules, chiffres et tirets (ex. bleuh-original-pre-rolls)." };
    }
    adresseEn = en;
  }

  const zones = zonesValides(src.zones);
  if (!zones) return { ok: false, error: "Zone : Québec, Canada, ou les deux." };

  if (mode === "tache") {
    if (!texteCourt(src.tacheId, 200)) return { ok: false, error: "Choisissez la tâche à relier." };
  } else if (!texteCourt(src.aQuoiSert, 4000)) {
    return { ok: false, error: "« À quoi sert la page » est requis." };
  }

  // Images en https seulement — exigence du hub : une capture dont le
  // téléversement aurait tourné court est écartée, sans faire échouer l'envoi.
  const captures = Array.isArray(src.captures)
    ? src.captures.filter((c): c is string => typeof c === "string" && /^https:\/\//.test(c.trim()))
    : [];
  if (captures.length > 5) return { ok: false, error: "Cinq captures au plus, comme un signalement." };

  const produits = Array.isArray(src.produits) ? src.produits.filter((p): p is string => typeof p === "string" && p.trim() !== "") : [];

  const debut = validerJourOuNull(src.debut, "Début");
  if (!debut.ok) return debut;
  const fin = validerJourOuNull(src.fin, "Fin");
  if (!fin.ok) return fin;
  const fenetre = validerFenetreAtterrissage(debut.value, fin.value, null);
  if (!fenetre.ok) return fenetre;

  if (src.visibilite !== "publique" && src.visibilite !== "privee") {
    return { ok: false, error: "Visibilité : publique ou privée." };
  }

  if (src.pretePourLe && !jourValide(src.pretePourLe)) {
    return { ok: false, error: "« Prête pour le » : date attendue au format AAAA-MM-JJ." };
  }

  return {
    ok: true,
    value: {
      mode,
      nom,
      adresseFr,
      adresseEn,
      zones,
      langues,
      aQuoiSert: mode === "tache" ? "" : texteCourt(src.aQuoiSert, 4000),
      aChanger: texteCourt(src.aChanger, 4000),
      maquetteLien: texteCourt(src.maquetteLien, 500),
      captures,
      produits,
      debut: debut.value,
      fin: fin.value,
      visibilite: src.visibilite,
      pretePourLe: jourValide(src.pretePourLe),
      tacheId: mode === "tache" ? texteCourt(src.tacheId, 200) : null,
    },
  };
}

// ─────────────────────────────────────────────────────────────
// Le texte du signalement — mot pour mot sur la maquette du plan.
// ─────────────────────────────────────────────────────────────

/** « Québec », « Canada », « Québec et Canada ». */
export function texteZones(zones: readonly Zone[]): string {
  const qc = zones.includes("qc");
  const ca = zones.includes("ca");
  return qc && ca ? "Québec et Canada" : qc ? "Québec" : "Canada";
}

/** « français et anglais », « français seulement ». */
export function texteLangues(langues: readonly Langue[]): string {
  return langues.includes("en") ? "français et anglais" : "français seulement";
}

export interface DonneesTexteSignalement {
  nom: string;
  adresseFr: string;
  /** Vide : page en français seulement. */
  adresseEn: string;
  zones: Zone[];
  langues: Langue[];
  demandeurNom: string;
  /** `null` en mode « tâche reliée » : la ligne devient « Voir la tâche reliée ». */
  aQuoiSert: string | null;
  aChanger: string;
  maquetteLien: string;
  nombreCaptures: number;
  /** Noms déjà résolus (catalogue), pas des identifiants. */
  produits: string[];
  /** Période déjà calculée (« Du 8 au 22 octobre 2026 ») ou `null` si aucune date. */
  periode: string | null;
  visibilite: Visibilite;
  /** Date longue déjà formatée (« 9 novembre 2026 ») ou `null`. */
  pretePourLe: string | null;
  ficheUrl: string;
}

const champOuPreciser = (v: string): string => (v.trim() ? v.trim() : AU_PRECISER);

/** Limites du hub (`POST /api/support/service`) : `title` ≤ 200, `message` ≤ 8000. */
const TITRE_MAX = 200;
const MESSAGE_MAX = 8000;

export interface SignalementTexte {
  title: string;
  message: string;
}

/**
 * Le texte EXACT reçu par Support Web, en deux morceaux — fonction PURE.
 *
 * Le hub compose lui-même `${title}\n\n${message}` : `title` est la seule
 * ligne « [Page d'atterrissage] … », `message` commence aux adresses et va
 * jusqu'à la règle Bleuh en 5 points (la même que la consigne de Shadowfax,
 * claude-remote worker/ticket-fix-worker.mjs#blocPage). Avec une tâche
 * reliée, le hub ajoute après le message un bloc « Tâche reliée : … ».
 */
export function texteDuSignalement(d: DonneesTexteSignalement): SignalementTexte {
  const aQuoiSert = d.aQuoiSert === null ? "Voir la tâche reliée" : champOuPreciser(d.aQuoiSert);
  const produitsTxt = d.produits.length > 0 ? d.produits.join(", ") : AU_PRECISER;
  const captures = d.nombreCaptures > 0 ? `${d.nombreCaptures} capture${d.nombreCaptures > 1 ? "s" : ""}` : "";
  const maquette = d.maquetteLien.trim()
    ? `${d.maquetteLien.trim()}${captures ? ` + ${captures}` : ""}`
    : captures || AU_PRECISER;
  const adresses = d.langues.includes("en") && d.adresseEn
    ? `bleuh.co/fr/${d.adresseFr} · bleuh.co/en/${d.adresseEn}`
    : `bleuh.co/fr/${d.adresseFr}`;

  const title = `[Page d'atterrissage] ${d.nom}`.slice(0, TITRE_MAX);
  const message = [
    adresses,
    "",
    `Demandée par ${d.demandeurNom},`,
    `depuis Marketing Bleuh › Pages d'atterrissage.`,
    "",
    `À quoi sert la page`,
    aQuoiSert,
    "",
    `À changer par rapport à la maquette`,
    champOuPreciser(d.aChanger),
    "",
    `Maquette : ${maquette}`,
    `Produits : ${produitsTxt}`,
    `Zone : ${texteZones(d.zones)}`,
    `Langues : ${texteLangues(d.langues)}`,
    `Dates : ${d.periode ?? "à régler dans Marketing Bleuh"}`,
    `Visibilité : ${d.visibilite === "publique" ? "publique" : "privée"}`,
    `Prête pour le : ${d.pretePourLe ?? AU_PRECISER}`,
    `Fiche : ${d.ficheUrl}`,
    "",
    `— À respecter : l'intégration avec Marketing Bleuh —`,
    `1. La page est déclarée sous « ${d.adresseFr} » : elle lit son état, ses dates et sa zone dans sa fiche.`,
    `2. Aucune date écrite dans la page ni dans ses textes : {periode}, {debut}, {fin}.`,
    `3. Avant l'ouverture : la préprod seulement. Après la fin : ce que dit la fiche.`,
    `4. Privée : jamais dans Google ni au plan du site.`,
    `5. Sous la barrière d'âge, sans prix ni incitatif ; le français de Dany, l'anglais du guide de marque, le sceau de marque à jour. npm test le vérifie. Marche à suivre : docs/PAGES-ATTERRISSAGE.md`,
  ].join("\n");

  return { title, message: message.length > MESSAGE_MAX ? `${message.slice(0, MESSAGE_MAX - 1)}…` : message };
}

/** Recolle `title` et `message` avec la ligne vide que le hub insère lui-même — pour l'aperçu à l'écran. */
export function apercuSignalement(t: SignalementTexte): string {
  return `${t.title}\n\n${t.message}`;
}
