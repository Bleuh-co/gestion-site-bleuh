/**
 * La discussion GANDALF d'une page ou d'une infolettre — src/lib/fils-pure.ts
 * (lot L10). Promis par le docblock du module ; posé ici (CONTRAT v2, lots
 * L10/L12 du 22/10/2026) avec les règles déjà en place.
 */
import { describe, expect, it } from "vitest";
import {
  ETAT_FIL_VIDE,
  etatPourMoi,
  filIdDe,
  lireFermetureFil,
  lireMajFil,
  messageOuvertureFil,
  type OuvertureFil,
} from "../src/lib/fils-pure";

describe("filIdDe — déterministe, ou vide si une pièce est invalide", () => {
  it("compose <appId>__<espace>__<objet>", () => {
    expect(filIdDe({ appId: "9oxbWs7SxVimUqLBkOhH", espace: "pages", objet: "bleuh-original-quebec" })).toBe(
      "9oxbWs7SxVimUqLBkOhH__pages__bleuh-original-quebec"
    );
  });

  it("espace inconnu, objet « . »/« .. », ou appId hors forme : vide", () => {
    expect(filIdDe({ appId: "9oxbWs7SxVimUqLBkOhH", espace: "infolettre", objet: "x" })).toBe("");
    expect(filIdDe({ appId: "9oxbWs7SxVimUqLBkOhH", espace: "pages", objet: ".." })).toBe("");
    expect(filIdDe({ appId: "", espace: "pages", objet: "x" })).toBe("");
  });
});

describe("etatPourMoi — { compte, nouveau } pour la personne connectée", () => {
  it("sans discussion : compte 0, jamais nouveau", () => {
    expect(etatPourMoi(undefined, "d.exemple@chanv.com")).toEqual({ compte: 0, nouveau: false });
  });

  it("un message qui n'est pas de moi, jamais vu : nouveau", () => {
    const fil = { compte: 2, dernier: { par: "a.autre@chanv.com", le: "2026-10-23T10:00:00.000Z" }, vu_par: {} };
    expect(etatPourMoi(fil, "d.exemple@chanv.com")).toEqual({ compte: 2, nouveau: true });
  });

  it("un message déjà vu depuis : pas nouveau", () => {
    const fil = {
      compte: 2,
      dernier: { par: "a.autre@chanv.com", le: "2026-10-23T10:00:00.000Z" },
      vu_par: { "d.exemple@chanv.com": "2026-10-23T11:00:00.000Z" },
    };
    expect(etatPourMoi(fil, "d.exemple@chanv.com")).toEqual({ compte: 2, nouveau: false });
  });

  it("le dernier message est de moi : jamais nouveau, même sans l'avoir vu", () => {
    const fil = { compte: 1, dernier: { par: "D.Exemple@chanv.com", le: "2026-10-23T10:00:00.000Z" }, vu_par: {} };
    expect(etatPourMoi(fil, "d.exemple@chanv.com")).toEqual({ compte: 1, nouveau: false });
  });
});

describe("messageOuvertureFil — CONTRAT v2 §1 : `ajustable` n'entre que s'il est défini", () => {
  const BASE: OuvertureFil = { espace: "pages", objet: "bleuh-original-quebec", titre: "Bleuh Original Québec", chemin: "/pages-atterrissage/x" };

  it("sans `ajustable` (campagne MailerLite) : le champ est absent du message", () => {
    const m = messageOuvertureFil(BASE);
    expect(m).not.toHaveProperty("ajustable");
    expect(m).toMatchObject({ type: "gandalf:fil", espace: "pages", objet: "bleuh-original-quebec", marque: "bleuh" });
  });

  it("`ajustable:true` ou `false` (page) : toujours transmis, jamais omis", () => {
    expect(messageOuvertureFil({ ...BASE, ajustable: true })).toHaveProperty("ajustable", true);
    expect(messageOuvertureFil({ ...BASE, ajustable: false })).toHaveProperty("ajustable", false);
  });

  it("resume vide par défaut ; { } jamais `undefined`", () => {
    expect(messageOuvertureFil(BASE).resume).toEqual({});
  });
});

describe("lireMajFil — CONTRAT v2 §2 : `ouvert` confirme la rangée active", () => {
  const FILID = "9oxbWs7SxVimUqLBkOhH__pages__x";

  it("ouvert:true → ouvert vrai", () => {
    expect(lireMajFil({ type: "gandalf:fil-maj", filId: FILID, espace: "pages", objet: "x", compte: 3, ouvert: true })).toEqual({
      filId: FILID,
      espace: "pages",
      objet: "x",
      compte: 3,
      ouvert: true,
    });
  });

  it("ouvert absent : une simple mise à jour de compte, jamais « ouvert » par défaut", () => {
    expect(lireMajFil({ type: "gandalf:fil-maj", filId: FILID, compte: 1 })?.ouvert).toBe(false);
  });

  it("un autre type de message, ou un compte/filId invalide : null", () => {
    expect(lireMajFil({ type: "gandalf:fil-ferme", filId: FILID })).toBeNull();
    expect(lireMajFil({ type: "gandalf:fil-maj", filId: "", compte: 1 })).toBeNull();
    expect(lireMajFil({ type: "gandalf:fil-maj", filId: FILID, compte: -1 })).toBeNull();
    expect(lireMajFil(null)).toBeNull();
  });
});

describe("lireFermetureFil — CONTRAT v2 §2 : `gandalf:fil-ferme` efface la rangée active", () => {
  const FILID = "9oxbWs7SxVimUqLBkOhH__infolettres__64035636";

  it("lit filId, espace, objet", () => {
    expect(lireFermetureFil({ type: "gandalf:fil-ferme", filId: FILID, espace: "infolettres", objet: "64035636" })).toEqual({
      filId: FILID,
      espace: "infolettres",
      objet: "64035636",
    });
  });

  it("un autre type, ou sans filId : null", () => {
    expect(lireFermetureFil({ type: "gandalf:fil-maj", filId: FILID })).toBeNull();
    expect(lireFermetureFil({ type: "gandalf:fil-ferme" })).toBeNull();
    expect(lireFermetureFil(undefined)).toBeNull();
  });
});

describe("ETAT_FIL_VIDE", () => {
  it("compte 0, pas de filId, jamais nouveau", () => {
    expect(ETAT_FIL_VIDE).toEqual({ filId: "", compte: 0, nouveau: false });
  });
});
