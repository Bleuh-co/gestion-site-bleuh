import { describe, expect, it } from "vitest";
import {
  champsPerimes,
  lireProductEs,
  textesDeLaFiche,
  textesDepuisReponse,
  textesVides,
  validerTextesEs,
} from "./products-es-pure";

const fiche = {
  name: { fr: "Blanh Indica", en: "Blanh Indica" },
  description: { fr: "Fleurs indica.", en: "Indica flower." },
  seoTitle: { fr: "", en: "" },
  metaDescription: { fr: "Méta", en: "Meta" },
  currentRotation: null,
  details: { format: { fr: "14 g", en: "14 g" }, effects: { fr: "Varient", en: "Varies by rotation" } },
};

describe("section espagnole d'une fiche produit", () => {
  it("met à plat les textes anglais d'une fiche", () => {
    const en = textesDeLaFiche(fiche, "en");
    expect(en.name).toBe("Blanh Indica");
    expect(en.details.effects).toBe("Varies by rotation");
    expect(en.details.terpenes).toBe("");
    expect(en.currentRotation).toBe("");
  });

  it("sans section espagnole, tout champ anglais rempli est à traduire", () => {
    expect(champsPerimes(null, textesDeLaFiche(fiche, "en"))).toEqual([
      "name",
      "description",
      "metaDescription",
      "details.format",
      "details.effects",
    ]);
  });

  it("repère le champ dont l'anglais a changé depuis la traduction", () => {
    const en = textesDeLaFiche(fiche, "en");
    const es = { ...textesVides(), name: "Blanh Indica", description: "Flor índica.", metaDescription: "Meta", details: { ...textesVides().details, format: "14 g", effects: "Varían según la rotación" }, source: en };
    expect(champsPerimes(es, en)).toEqual([]);
    const apres = { ...en, description: "Indica flower, sun-grown." };
    expect(champsPerimes(es, apres)).toEqual(["description"]);
  });

  it("n'enregistre que les champs connus, et refuse ce qui n'est pas du texte", () => {
    const v = validerTextesEs({ name: " Flor ", description: "a\nb", intrus: "x", details: { format: " 14 g ", intrus: "y" } });
    expect(v.ok && v.value.name).toBe("Flor");
    expect(v.ok && v.value.description).toBe("a\nb");
    expect(v.ok && (v.value as unknown as Record<string, unknown>).intrus).toBeUndefined();
    expect(v.ok && v.value.details.format).toBe("14 g");
    expect(validerTextesEs({ name: 3 }).ok).toBe(false);
    expect(validerTextesEs(null).ok).toBe(false);
  });

  it("lit la réponse du modèle, même entourée de texte, sans inventer de champ", () => {
    const en = textesDeLaFiche(fiche, "en");
    const r = textesDepuisReponse('Voici :\n{"name":"Blanh Indica","description":"Flor índica.","details.format":"14 g","details.terpenes":"inventé","seoTitle":"inventé"}', en);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.description).toBe("Flor índica.");
    expect(r.value.details.terpenes).toBe("");
    expect(r.value.seoTitle).toBe("");
    expect(textesDepuisReponse("pas de json", en).ok).toBe(false);
  });

  it("relit un document avec indulgence", () => {
    const es = lireProductEs("blanh-indica", { name: "Blanh Indica", description: 4, mode: "manuel", source: { name: "Blanh Indica" } });
    expect(es?.name).toBe("");
    expect(es?.mode).toBe("manuel");
    expect(es?.source.name).toBe("Blanh Indica");
    expect(lireProductEs("x", null)).toBeNull();
  });
});
