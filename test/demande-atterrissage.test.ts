/**
 * « Demander une page », côté Bleuh — src/lib/demande-atterrissage-pure.ts
 * (lot L10). Le texte du signalement est vérifié MOT POUR MOT contre la
 * maquette du plan (« Demander une page, côté Bleuh ») : c'est ce que lit
 * l'équipe du site, et ce que la consigne de Shadowfax suppose.
 */
import { describe, expect, it } from "vitest";
import {
  apercuSignalement,
  slugifier,
  texteDuSignalement,
  texteLangues,
  texteZones,
  validerDemande,
  type DonneesTexteSignalement,
} from "../src/lib/demande-atterrissage-pure";

const FORMULAIRE = {
  mode: "decrire",
  nom: "Préroulés Bleuh Original",
  adresseFr: "preroules-bleuh-original",
  adresseEn: "bleuh-original-pre-rolls",
  zones: ["qc"],
  langues: ["fr", "en"],
  aQuoiSert: "Présenter les préroulés balancés de Bleuh Original au Québec : les deux profils, où les trouver à la SQDC.",
  aChanger: "Le titre de Dany tel quel.",
  maquetteLien: "",
  captures: ["https://storage.googleapis.com/b/site-assets/atterrissages/2026/10/a.png"],
  produits: ["bleuh-original-medellin-fog-balance"],
  debut: "",
  fin: "",
  visibilite: "privee",
  pretePourLe: "2026-11-09",
};

describe("validerDemande", () => {
  it("accepte la demande de la maquette", () => {
    const r = validerDemande(FORMULAIRE);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toMatchObject({
      adresseFr: "preroules-bleuh-original",
      adresseEn: "bleuh-original-pre-rolls",
      zones: ["qc"],
      langues: ["fr", "en"],
      debut: null,
      fin: null,
      pretePourLe: "2026-11-09",
    });
  });

  it("aucune offre, même par un appel direct : bleuh.co ne vend rien", () => {
    expect(validerDemande({ ...FORMULAIRE, offreMode: "lot" })).toEqual({
      ok: false,
      error: "bleuh.co ne vend rien : une page Bleuh ne porte ni prix ni offre.",
    });
  });

  it("français seulement : pas d'adresse anglaise exigée, ni gardée", () => {
    const r = validerDemande({ ...FORMULAIRE, langues: ["fr"], adresseEn: "n'importe quoi" });
    expect(r.ok && [r.value.langues, r.value.adresseEn]).toEqual([["fr"], ""]);
  });

  it("refuse une adresse anglaise invalide, une zone inconnue, un « à quoi sert » vide", () => {
    expect(validerDemande({ ...FORMULAIRE, adresseEn: "Pre Rolls" }).ok).toBe(false);
    expect(validerDemande({ ...FORMULAIRE, zones: ["on"] }).ok).toBe(false);
    expect(validerDemande({ ...FORMULAIRE, aQuoiSert: " " }).ok).toBe(false);
  });

  it("en mode tâche, la tâche remplace « à quoi sert »", () => {
    expect(validerDemande({ ...FORMULAIRE, mode: "tache", aQuoiSert: "" }).ok).toBe(false);
    const r = validerDemande({ ...FORMULAIRE, mode: "tache", aQuoiSert: "", tacheId: "abc" });
    expect(r.ok && [r.value.tacheId, r.value.aQuoiSert]).toEqual(["abc", ""]);
  });

  it("écarte une capture qui n'est pas en https, et en refuse plus de cinq", () => {
    const r = validerDemande({ ...FORMULAIRE, captures: ["http://x/a.png", "/local.png", FORMULAIRE.captures[0]] });
    expect(r.ok && r.value.captures).toEqual([FORMULAIRE.captures[0]]);
    expect(validerDemande({ ...FORMULAIRE, captures: Array(6).fill(FORMULAIRE.captures[0]) }).ok).toBe(false);
  });

  it("une fin avant le début est refusée", () => {
    expect(validerDemande({ ...FORMULAIRE, debut: "2026-11-09", fin: "2026-11-01" }).ok).toBe(false);
  });
});

describe("slugifier", () => {
  it("sans accents, court, coupé entre deux mots", () => {
    expect(slugifier("Préroulés Bleuh Original")).toBe("preroules-bleuh-original");
    expect(slugifier("Lancement de la nouvelle gamme Bleuh Original au Québec cet hiver").length).toBeLessThanOrEqual(40);
  });
});

describe("texteDuSignalement — mot pour mot", () => {
  const DONNEES: DonneesTexteSignalement = {
    nom: "Préroulés Bleuh Original",
    adresseFr: "preroules-bleuh-original",
    adresseEn: "bleuh-original-pre-rolls",
    zones: ["qc"],
    langues: ["fr", "en"],
    demandeurNom: "Daphnée Paquette",
    aQuoiSert:
      "Présenter les préroulés balancés de Bleuh Original au Québec : les deux profils, où les trouver à la SQDC. On y mène depuis l'infolettre QFR.",
    aChanger: "Le titre de Dany tel quel ; le bloc « Où les trouver » sous les deux profils.",
    maquetteLien: "",
    nombreCaptures: 3,
    produits: ["Medellin Fog", "Northern Pine"],
    periode: null,
    visibilite: "privee",
    pretePourLe: "9 novembre 2026",
    ficheUrl: "https://marketing.bleuh.co/pages-atterrissage/preroules-bleuh-original",
  };

  it("le texte de la maquette, règle Bleuh comprise", () => {
    expect(apercuSignalement(texteDuSignalement(DONNEES))).toBe(
      [
        "[Page d'atterrissage] Préroulés Bleuh Original",
        "",
        "bleuh.co/fr/preroules-bleuh-original · bleuh.co/en/bleuh-original-pre-rolls",
        "",
        "Demandée par Daphnée Paquette,",
        "depuis Marketing Bleuh › Pages d'atterrissage.",
        "",
        "À quoi sert la page",
        "Présenter les préroulés balancés de Bleuh Original au Québec : les deux profils, où les trouver à la SQDC. On y mène depuis l'infolettre QFR.",
        "",
        "À changer par rapport à la maquette",
        "Le titre de Dany tel quel ; le bloc « Où les trouver » sous les deux profils.",
        "",
        "Maquette : 3 captures",
        "Produits : Medellin Fog, Northern Pine",
        "Zone : Québec",
        "Langues : français et anglais",
        "Dates : à régler dans Marketing Bleuh",
        "Visibilité : privée",
        "Prête pour le : 9 novembre 2026",
        "Fiche : https://marketing.bleuh.co/pages-atterrissage/preroules-bleuh-original",
        "",
        "— À respecter : l'intégration avec Marketing Bleuh —",
        "1. La page est déclarée sous « preroules-bleuh-original » : elle lit son état, ses dates et sa zone dans sa fiche.",
        "2. Aucune date écrite dans la page ni dans ses textes : {periode}, {debut}, {fin}.",
        "3. Avant l'ouverture : la préprod seulement. Après la fin : ce que dit la fiche.",
        "4. Privée : jamais dans Google ni au plan du site.",
        "5. Sous la barrière d'âge, sans prix ni incitatif ; le français de Dany, l'anglais du guide de marque, le sceau de marque à jour. npm test le vérifie. Marche à suivre : docs/PAGES-ATTERRISSAGE.md",
      ].join("\n")
    );
  });

  it("le titre est la seule ligne « [Page d'atterrissage] » : le hub l'ajoute lui-même au message", () => {
    const t = texteDuSignalement(DONNEES);
    expect(t.title).toBe("[Page d'atterrissage] Préroulés Bleuh Original");
    expect(t.message).not.toContain("[Page d'atterrissage]");
  });

  it("français seulement, tâche reliée, rien de facultatif rempli", () => {
    const m = texteDuSignalement({
      ...DONNEES,
      adresseEn: "",
      langues: ["fr"],
      zones: ["qc", "ca"],
      aQuoiSert: null,
      aChanger: "",
      nombreCaptures: 0,
      produits: [],
      periode: "Du 9 au 30 novembre 2026",
      visibilite: "publique",
      pretePourLe: null,
    }).message;
    expect(m.split("\n")[0]).toBe("bleuh.co/fr/preroules-bleuh-original");
    for (const ligne of [
      "Voir la tâche reliée",
      "Maquette : à préciser",
      "Produits : à préciser",
      "Zone : Québec et Canada",
      "Langues : français seulement",
      "Dates : Du 9 au 30 novembre 2026",
      "Visibilité : publique",
      "Prête pour le : à préciser",
    ]) {
      expect(m.split("\n")).toContain(ligne);
    }
  });

  it("aucun prix ni « offre » dans le texte", () => {
    const m = texteDuSignalement(DONNEES).message;
    expect(m).not.toMatch(/\$|Offre :/);
  });

  it("le lien de maquette et les captures se cumulent", () => {
    const m = texteDuSignalement({ ...DONNEES, maquetteLien: "https://figma.com/x", nombreCaptures: 1 }).message;
    expect(m.split("\n")).toContain("Maquette : https://figma.com/x + 1 capture");
  });

  it("zones et langues en clair", () => {
    expect([texteZones(["qc"]), texteZones(["ca"]), texteZones(["qc", "ca"])]).toEqual(["Québec", "Canada", "Québec et Canada"]);
    expect([texteLangues(["fr", "en"]), texteLangues(["fr"])]).toEqual(["français et anglais", "français seulement"]);
  });
});
