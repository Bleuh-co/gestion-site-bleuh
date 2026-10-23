/**
 * Les pages d'atterrissage de bleuh.co — src/lib/atterrissages-pure.ts (lot L10).
 *
 * ⚠ Ce fichier sera recopié tel quel dans site-bleuh (lot L11), avec le
 * module : mêmes littéraux, pour que Marketing Bleuh et bleuh.co ne
 * divergent jamais sur un état, une phrase, une zone ou une borne d'heure.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  adresseDansLaLangue,
  adresseValide,
  cheminDeRenvoi,
  cheminInterne,
  etatDeLaPage,
  jourValide,
  lireFiche,
  ouverteDansLaZone,
  pageAjustable,
  phrasesDeLaPage,
  remplir,
  validerPatchAtterrissage,
  valeursDesPhrases,
  zonesValides,
  type EtatPage,
  type FicheAtterrissage,
} from "../src/lib/atterrissages-pure";
import { ouvertureFilPage } from "../src/lib/atterrissage-discussion-pure";
import { messageOuvertureFil } from "../src/lib/fils-pure";

const a = (iso: string) => Date.parse(iso);
const midi = (jour: string) => a(`${jour}T12:00:00-04:00`);

const brut = {
  nom: "Préroulés Bleuh Original",
  adresse: { fr: "preroules-bleuh-original", en: "bleuh-original-pre-rolls" },
  zones: ["qc"],
  langues: ["fr", "en"],
  active: true,
  livree: true,
  debut: "2026-11-09",
  fin: "2026-11-30",
  apercu: "2026-11-02",
  visibilite: "privee",
  apres: "terminee",
  renvoi: null,
  produits: ["bleuh-original-medellin-fog-balance"],
  demande: { ticket: "T1", tache: null, par: "d.exemple@chanv.com", le: "2026-10-22T20:00:00.000Z" },
};

const PAGE = lireFiche("preroules-bleuh-original", brut)!;

describe("les valeurs d'une fiche", () => {
  it("un jour est un vrai jour AAAA-MM-JJ", () => {
    expect(jourValide("2026-10-22")).toBe("2026-10-22");
    expect(jourValide("2026-02-29")).toBeNull();
    expect(jourValide("2028-02-29")).toBe("2028-02-29");
    expect(jourValide("2026-10-22T00:00")).toBeNull();
    expect(jourValide(20261022)).toBeNull();
  });

  it("un renvoi est un chemin INTERNE", () => {
    expect(cheminInterne("/produits")).toBe("/produits");
    expect(cheminInterne("//exemple.com/")).toBeNull();
    expect(cheminInterne("https://exemple.com/")).toBeNull();
    expect(cheminInterne("/\\exemple.com")).toBeNull();
    expect(cheminInterne("/javascript:alert(1)")).toBeNull();
  });

  it("une adresse : minuscules, chiffres, tirets", () => {
    expect(adresseValide("bleuh-original-quebec")).toBe("bleuh-original-quebec");
    expect(adresseValide("Bleuh")).toBeNull();
    expect(adresseValide("bleuh--original")).toBeNull();
  });

  it("les zones : Québec, Canada, ou les deux, toujours dans le même ordre", () => {
    expect(zonesValides(["qc"])).toEqual(["qc"]);
    expect(zonesValides(["ca", "qc", "qc"])).toEqual(["qc", "ca"]);
    expect(zonesValides([])).toBeNull();
    expect(zonesValides(["on"])).toBeNull();
    expect(zonesValides("qc")).toBeNull();
  });
});

describe("lireFiche — strictement, sans deviner", () => {
  it("lit une fiche complète, sans aucune offre", () => {
    expect(PAGE.zones).toEqual(["qc"]);
    expect(PAGE.langues).toEqual(["fr", "en"]);
    expect(PAGE.adresse).toEqual({ fr: "preroules-bleuh-original", en: "bleuh-original-pre-rolls" });
    expect("offre" in PAGE).toBe(false);
  });

  it("une date illisible, ou une fin avant le début : toute la fiche est illisible", () => {
    expect(lireFiche("preroules-bleuh-original", { ...brut, fin: "2026-11-31" })).toBeNull();
    expect(lireFiche("preroules-bleuh-original", { ...brut, fin: "2026-11-08" })).toBeNull();
  });

  it("une zone absente ou inconnue : la page ne s'ouvre nulle part plutôt que partout", () => {
    expect(lireFiche("preroules-bleuh-original", { ...brut, zones: undefined })).toBeNull();
    expect(lireFiche("preroules-bleuh-original", { ...brut, zones: ["qc", "on"] })).toBeNull();
  });

  it("français seulement : par les langues, ou par une adresse anglaise vide", () => {
    const f1 = lireFiche("x", { ...brut, langues: ["fr"] })!;
    expect([f1.langues, f1.adresse.en]).toEqual([["fr"], ""]);
    const f2 = lireFiche("x", { ...brut, langues: undefined, adresse: { fr: "x", en: "" } })!;
    expect(f2.langues).toEqual(["fr"]);
  });

  it("dans le doute, privée ; un aperçu après le début est ignoré ; un renvoi invalide vaut « retirée »", () => {
    const f = lireFiche("x", { ...brut, visibilite: "?", apercu: "2026-11-10", apres: "renvoi", renvoi: "https://ailleurs.com" })!;
    expect([f.visibilite, f.apercu, f.apres, f.renvoi]).toEqual(["privee", null, "retiree", null]);
  });
});

describe("la zone et la langue", () => {
  it("la page ne s'ouvre que dans sa zone", () => {
    expect(ouverteDansLaZone(PAGE, "qc")).toBe(true);
    expect(ouverteDansLaZone(PAGE, "ca")).toBe(false);
    expect(ouverteDansLaZone({ zones: ["qc", "ca"] }, "ca")).toBe(true);
  });

  it("l'adresse dans une langue, et pas d'adresse anglaise pour une page en français seulement", () => {
    expect(adresseDansLaLangue(PAGE, "en")).toBe("bleuh-original-pre-rolls");
    expect(adresseDansLaLangue({ ...PAGE, langues: ["fr"], adresse: { fr: "x", en: "" } }, "en")).toBeNull();
  });

  it("le renvoi porte la langue : bleuh.co préfixe toutes ses adresses", () => {
    expect(cheminDeRenvoi({ apres: "renvoi", renvoi: "/" }, "fr")).toBe("/fr");
    expect(cheminDeRenvoi({ apres: "renvoi", renvoi: "/produits" }, "en")).toBe("/en/produits");
    expect(cheminDeRenvoi({ apres: "retiree", renvoi: null }, "fr")).toBeNull();
  });
});

describe("etatDeLaPage — les six états, à l'heure de Montréal", () => {
  it("en préparation tant qu'elle n'est pas livrée", () => {
    expect(etatDeLaPage({ ...PAGE, livree: false }, midi("2026-11-10"), true)).toBe("preparation");
  });

  it("prête : livrée sans début, ou éteinte avant son début", () => {
    expect(etatDeLaPage({ ...PAGE, debut: null, fin: null }, midi("2026-11-10"), true)).toBe("prete");
    expect(etatDeLaPage({ ...PAGE, active: false }, midi("2026-11-05"), true)).toBe("prete");
  });

  it("programmée, en ligne, terminée : à minuit pile (heure normale, UTC−5)", () => {
    expect(etatDeLaPage(PAGE, a("2026-11-08T23:59:59-05:00"), true)).toBe("programmee");
    expect(etatDeLaPage(PAGE, a("2026-11-09T00:00:00-05:00"), true)).toBe("en-ligne");
    expect(etatDeLaPage(PAGE, a("2026-11-30T23:59:59-05:00"), true)).toBe("en-ligne");
    expect(etatDeLaPage(PAGE, a("2026-12-01T00:00:00-05:00"), true)).toBe("terminee");
  });

  it("éteinte : l'interrupteur coupé après le début", () => {
    expect(etatDeLaPage({ ...PAGE, active: false }, midi("2026-11-10"), true)).toBe("eteinte");
  });

  it("pageAjustable (CONTRAT v2 §1) : jamais en préparation, toujours dans les cinq autres états", () => {
    const ETATS: EtatPage[] = ["preparation", "prete", "programmee", "en-ligne", "terminee", "eteinte"];
    expect(ETATS.map(pageAjustable)).toEqual([false, true, true, true, true, true]);
  });

  it("l'aperçu l'ouvre en avance hors production, jamais sur bleuh.co", () => {
    expect(etatDeLaPage(PAGE, midi("2026-11-03"), false)).toBe("en-ligne");
    expect(etatDeLaPage(PAGE, midi("2026-11-03"), true)).toBe("programmee");
  });

  it("le passage à l'heure normale : le dernier jour compte en entier", () => {
    const f = { ...PAGE, debut: "2026-10-20", fin: "2026-11-01", apercu: null };
    expect(etatDeLaPage(f, a("2026-11-01T23:59:59-05:00"), true)).toBe("en-ligne");
    expect(etatDeLaPage(f, a("2026-11-02T00:00:00-05:00"), true)).toBe("terminee");
  });
});

describe("phrasesDeLaPage — les dates s'écrivent toutes seules", () => {
  it("dans les deux langues", () => {
    expect(phrasesDeLaPage(PAGE, "fr")).toEqual({
      periode: "Du 9 au 30 novembre 2026",
      debut: "9 novembre 2026",
      fin: "30 novembre 2026",
      du_au: "du 9 au 30 novembre",
    });
    expect(phrasesDeLaPage(PAGE, "en").periode).toBe("November 9–30, 2026");
  });

  it("sans fin : « Dès le 30 septembre 2026 »", () => {
    expect(phrasesDeLaPage({ debut: "2026-09-30", fin: null }, "fr").periode).toBe("Dès le 30 septembre 2026");
    expect(phrasesDeLaPage({ debut: "2026-09-30", fin: null }, "en").periode).toBe("From September 30, 2026");
  });

  it("remplir : un repère inconnu devient vide", () => {
    expect(remplir("{periode}{inconnu}", valeursDesPhrases(phrasesDeLaPage(PAGE, "fr")))).toBe("Du 9 au 30 novembre 2026");
  });
});

describe("validerPatchAtterrissage — liste blanche, zone comprise", () => {
  const actuel: Pick<FicheAtterrissage, "debut" | "fin" | "apercu" | "apres" | "renvoi"> = PAGE;

  it("la zone se change depuis la fiche", () => {
    expect(validerPatchAtterrissage({ zones: ["ca", "qc"] }, actuel)).toEqual({ ok: true, value: { zones: ["qc", "ca"] } });
    expect(validerPatchAtterrissage({ zones: [] }, actuel).ok).toBe(false);
  });

  it("refuse un champ inconnu — une offre ou un prix n'entre pas par là", () => {
    const r = validerPatchAtterrissage({ offre: { sorte: "lot", id: "x" } }, actuel);
    expect(r).toEqual({ ok: false, error: "Champ non modifiable : offre." });
    expect(validerPatchAtterrissage({ langues: ["fr"] }, actuel).ok).toBe(false);
  });

  it("vérifie la fenêtre sur l'état RÉSULTANT", () => {
    expect(validerPatchAtterrissage({ fin: "2026-11-01" }, actuel).ok).toBe(false);
  });

  it("un renvoi exige un chemin ; un autre « après la fin » l'efface", () => {
    expect(validerPatchAtterrissage({ apres: "renvoi" }, actuel).ok).toBe(false);
    expect(validerPatchAtterrissage({ apres: "renvoi", renvoi: "/produits" }, actuel)).toEqual({
      ok: true,
      value: { apres: "renvoi", renvoi: "/produits" },
    });
    expect(validerPatchAtterrissage({ apres: "retiree" }, { ...actuel, apres: "renvoi", renvoi: "/" })).toEqual({
      ok: true,
      value: { apres: "retiree", renvoi: null },
    });
  });
});

describe("le module se partage avec bleuh.co", () => {
  it("n'importe rien : site-bleuh le recopie tel quel (lot L11)", () => {
    const source = readFileSync(new URL("../src/lib/atterrissages-pure.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/^\s*import\s/m);
  });
});

describe("les trois pages faites avant l'espace (scripts/atterrissages-existantes.json)", () => {
  const { fiches } = JSON.parse(readFileSync(new URL("../scripts/atterrissages-existantes.json", import.meta.url), "utf8")) as {
    fiches: Record<string, Record<string, unknown>>;
  };
  // Ce que l'amorçage écrit en plus des données du fichier.
  const commeAmorcees = (f: Record<string, unknown>) => ({ ...f, active: true, livree: true, fin: null, visibilite: "publique", apres: "terminee" });

  it("Bleuh Original Québec, Wildberry et Nouveaux produits, aux adresses que sert bleuh.co aujourd'hui", () => {
    expect(Object.keys(fiches).sort()).toEqual(["bleuh-original-quebec", "bleuh-original-wildberry", "new-products"]);
  });

  it("chacune se lit et s'affiche « En ligne » aujourd'hui, sans date de fin", () => {
    for (const [id, f] of Object.entries(fiches)) {
      const fiche = lireFiche(id, commeAmorcees(f));
      expect(fiche, id).not.toBeNull();
      expect(etatDeLaPage(fiche!, midi("2026-10-23"), true), id).toBe("en-ligne");
    }
  });

  it("les zones du plan : Québec ; Québec et Canada ; Canada", () => {
    expect(fiches["bleuh-original-quebec"].zones).toEqual(["qc"]);
    expect(fiches["bleuh-original-wildberry"].zones).toEqual(["qc", "ca"]);
    expect(fiches["new-products"].zones).toEqual(["ca"]);
  });
});

describe("ouvertureFilPage — CONTRAT v2 §1, ajustable TOUJOURS envoyé pour une page", () => {
  const LIBELLES = {
    contexte: "Page d'atterrissage Bleuh",
    etat: "En ligne",
    dates: { libelle: "Dates", valeur: "" },
    zone: { libelle: "Zone", valeur: "Québec" },
    visibilite: { libelle: "Visibilité", valeur: "Publique" },
    fiche: "Ouvrir la fiche",
  };

  it("une page ajustable : le message `gandalf:fil` porte `ajustable:true`", () => {
    const o = ouvertureFilPage({ ...PAGE, ajustable: true }, LIBELLES);
    expect(o.ajustable).toBe(true);
    expect(messageOuvertureFil(o)).toMatchObject({ ajustable: true });
  });

  it("une page « en préparation » : `ajustable:false` — jamais omis, contrairement à une campagne", () => {
    const o = ouvertureFilPage({ ...PAGE, ajustable: false }, LIBELLES);
    expect(o.ajustable).toBe(false);
    expect(messageOuvertureFil(o)).toMatchObject({ ajustable: false });
    expect(messageOuvertureFil(o)).toHaveProperty("ajustable");
  });

  it("« Voir sur la préprod » : une adresse https après « Ouvrir la fiche », absente sans préprod (écrans §3)", () => {
    const url = "https://sitebleuh-dev.example/fr/bleuh-original-quebec";
    const avec = ouvertureFilPage({ ...PAGE, ajustable: true }, { ...LIBELLES, preprod: { libelle: "Voir sur la préprod", url } });
    expect(avec.resume?.liens).toEqual([
      { libelle: "Ouvrir la fiche", chemin: `/pages-atterrissage/${PAGE.id}` },
      { libelle: "Voir sur la préprod", url },
    ]);
    const sans = ouvertureFilPage({ ...PAGE, ajustable: true }, { ...LIBELLES, preprod: { libelle: "Voir sur la préprod", url: null } });
    expect(sans.resume?.liens).toEqual([{ libelle: "Ouvrir la fiche", chemin: `/pages-atterrissage/${PAGE.id}` }]);
  });
});
