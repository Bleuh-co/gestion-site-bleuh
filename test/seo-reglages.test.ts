/**
 * Les réglages de titres et descriptions — src/lib/seo-reglages-pure.ts,
 * module PARTAGÉ avec bleuh.co (site-bleuh/src/lib/seo-reglages-pure.ts).
 * Les mêmes cas tournent là-bas sous node:test (`seo-reglages-pure.test.ts`).
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  COLLECTION_SEO,
  MAX_DESCRIPTION,
  MAX_TITRE,
  cheminDeAdresse,
  cheminDeCle,
  cleDeChemin,
  langueDuChemin,
  lireReglage,
  reglageVide,
  validerReglage,
} from "../src/lib/seo-reglages-pure";

/**
 * L'empreinte du module, la même dans les deux dépôts. Si ce test échoue,
 * `seo-reglages-pure.ts` a été modifié : le recopier TEL QUEL dans
 * site-bleuh/src/lib/, puis mettre la nouvelle empreinte ici ET dans
 * site-bleuh/src/lib/seo-reglages-pure.test.ts.
 */
const EMPREINTE_MODULE = "0f2ec5b2d355bb3450f3b136ee8df40982bc5da41d0afb3a438641820b34aeab";

describe("seo-reglages-pure (copie conforme de bleuh.co)", () => {
  it("le module est la copie conforme de celui de bleuh.co", () => {
    const source = readFileSync(join(__dirname, "..", "src", "lib", "seo-reglages-pure.ts"));
    expect(createHash("sha256").update(source).digest("hex")).toBe(EMPREINTE_MODULE);
  });

  it("la collection est celle que bleuh.co lit", () => {
    expect(COLLECTION_SEO).toBe("bleuh_site_seo");
  });

  it("une adresse de bleuh.co se ramène à son chemin, quelle que soit sa forme", () => {
    expect(cheminDeAdresse("https://bleuh.co/fr/notre-histoire")).toBe("/fr/notre-histoire");
    expect(cheminDeAdresse("https://bleuh.co/fr/notre-histoire/")).toBe("/fr/notre-histoire");
    expect(cheminDeAdresse("https://dev150423.bleuh.co/en/our-story?x=1#haut")).toBe("/en/our-story");
    expect(cheminDeAdresse("/fr")).toBe("/fr");
    expect(cheminDeAdresse("https://bleuh.co/en")).toBe("/en");
    expect(cheminDeAdresse("fr/vos-reperes/thc-et-cbd")).toBe("/fr/vos-reperes/thc-et-cbd");
  });

  it("tout ce qui n'est pas une page /fr ou /en de bleuh.co est refusé", () => {
    for (const mauvais of ["", "   ", "/", "/es/x", "/fr/../admin", "/fr/Notre-Histoire", "/fr/a b", "/fr//x", "/api/seo", null, undefined]) {
      expect(cheminDeAdresse(mauvais as string)).toBeNull();
    }
  });

  it("la clé est le chemin, segments joints par __", () => {
    expect(cleDeChemin("/fr")).toBe("fr");
    expect(cleDeChemin("/en")).toBe("en");
    expect(cleDeChemin("/fr/notre-histoire/nos-procedes/haschich")).toBe("fr__notre-histoire__nos-procedes__haschich");
    expect(cheminDeCle("fr__notre-histoire__nos-procedes__haschich")).toBe("/fr/notre-histoire/nos-procedes/haschich");
    expect(cheminDeCle("en")).toBe("/en");
    expect(cheminDeCle("es__x")).toBeNull();
    expect(cheminDeCle("")).toBeNull();
  });

  it("la langue vient du premier segment", () => {
    expect(langueDuChemin("/fr/carte")).toBe("fr");
    expect(langueDuChemin("/en/map")).toBe("en");
  });

  it("un document se lit avec indulgence : un champ illisible vaut le texte du site", () => {
    const r = lireReglage("fr__contact", {
      title: "  Nous joindre\n| Bleuh ",
      description: 42,
      ogImage: "http://exemple.com/x.jpg",
      updatedBy: "d.paquette@chanv.com",
    });
    expect(r).toEqual({ cle: "fr__contact", chemin: "/fr/contact", title: "Nous joindre | Bleuh", description: "", ogImage: "" });
    expect(lireReglage("pas une clé", { title: "x" })).toBeNull();
    expect(reglageVide(lireReglage("fr", {})!)).toBe(true);
    expect(lireReglage("fr", { title: "x".repeat(MAX_TITRE + 50) })!.title.length).toBe(MAX_TITRE);
  });

  it("l'écriture n'accepte que titre, description et image https", () => {
    expect(validerReglage({ title: " Notre histoire  |  Bleuh ", description: "Nos débuts.\nNotre approche.", ogImage: "" })).toEqual({
      ok: true,
      value: { title: "Notre histoire | Bleuh", description: "Nos débuts. Notre approche.", ogImage: "" },
    });
    expect(validerReglage({})).toEqual({ ok: true, value: { title: "", description: "", ogImage: "" } });
    expect(validerReglage({ title: "x", noindex: true }).ok).toBe(false);
    expect(validerReglage({ title: 3 }).ok).toBe(false);
    expect(validerReglage({ ogImage: "http://bleuh.co/x.jpg" }).ok).toBe(false);
    expect(validerReglage({ ogImage: "https://bleuh.co/images/x.webp" }).ok).toBe(true);
    expect(validerReglage({ title: "x".repeat(MAX_TITRE + 1) }).ok).toBe(false);
    expect(validerReglage({ description: "x".repeat(MAX_DESCRIPTION + 1) }).ok).toBe(false);
    expect(validerReglage(null).ok).toBe(false);
    expect(validerReglage([]).ok).toBe(false);
  });
});
