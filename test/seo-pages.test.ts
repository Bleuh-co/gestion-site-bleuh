/**
 * Titres et descriptions : la liste des pages de bleuh.co, lue dans son plan
 * du site, et la lecture de l'en-tête d'une page en ligne
 * (src/lib/seo-pages-pure.ts).
 */
import { describe, expect, it } from "vitest";
import { decoderEntites, estFicheProduit, lirePlanDuSite, lireTete, pagesDuPlan } from "../src/lib/seo-pages-pure";

/** Un extrait du vrai plan du site (06/11/2026), même mise en forme. */
const url = (loc: string, fr?: string, en?: string) => `<url>
<loc>https://bleuh.co${loc}</loc>
${fr ? `<xhtml:link rel="alternate" hreflang="fr-CA" href="https://bleuh.co${fr}" />` : ""}
${en ? `<xhtml:link rel="alternate" hreflang="en-CA" href="https://bleuh.co${en}" />` : ""}
${fr ? `<xhtml:link rel="alternate" hreflang="x-default" href="https://bleuh.co${fr}" />` : ""}
<lastmod>2026-11-06T19:39:26.478Z</lastmod>
</url>`;
const PLAN = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${url("/fr", "/fr", "/en")}
${url("/en", "/fr", "/en")}
${url("/fr/notre-histoire", "/fr/notre-histoire", "/en/our-story")}
${url("/en/our-story", "/fr/notre-histoire", "/en/our-story")}
${url("/fr/collections", "/fr/collections", "/en/collections")}
${url("/en/collections/skyh")}
${url("/fr/vos-reperes/thc-et-cbd", "/fr/vos-reperes/thc-et-cbd", "/en/your-bearings/thc-and-cbd")}
${url("/fr/varietes/blue-dream", "/fr/varietes/blue-dream", "/en/strains/blue-dream")}
${url("/en/strains/blue-dream", "/fr/varietes/blue-dream", "/en/strains/blue-dream")}
${url("/fr/produit/blakh-haze", "/fr/produit/blakh-haze", "/en/product/blakh-haze")}
${url("/en/product/blakh-haze", "/fr/produit/blakh-haze", "/en/product/blakh-haze")}
${url("/fr/produits/formats/fleurs", "/fr/produits/formats/fleurs", "/en/products/formats/flower")}
${url("/fr/politique-de-confidentialite", "/fr/politique-de-confidentialite", "/en/privacy-policy")}
${url("/en/privacy-policy", "/fr/politique-de-confidentialite", "/en/privacy-policy")}
</urlset>`;

describe("le plan du site de bleuh.co", () => {
  it("chaque <url> donne son chemin et ses équivalents annoncés", () => {
    const entrees = lirePlanDuSite(PLAN);
    expect(entrees).toHaveLength(14);
    expect(entrees[0]).toEqual({ chemin: "/fr", fr: "/fr", en: "/en" });
    expect(entrees.find((e) => e.chemin === "/en/collections/skyh")).toEqual({ chemin: "/en/collections/skyh", fr: null, en: null });
  });

  it("les fiches produits sont écartées : elles se règlent dans Produits", () => {
    expect(estFicheProduit("/fr/produit/blakh-haze")).toBe(true);
    expect(estFicheProduit("/en/product/blakh-haze")).toBe(true);
    expect(estFicheProduit("/fr/produits")).toBe(false);
    const ids = pagesDuPlan(lirePlanDuSite(PLAN)).map((p) => p.id);
    expect(ids.some((id) => id.includes("produit/"))).toBe(false);
  });

  it("français et anglais d'une même page sont réunis ; une langue absente du plan n'est pas montrée", () => {
    const pages = pagesDuPlan(lirePlanDuSite(PLAN));
    const par = (id: string) => pages.find((p) => p.id === id);
    expect(par("/fr")?.adresses).toEqual({ fr: "/fr", en: "/en" });
    expect(par("/fr/notre-histoire")?.adresses).toEqual({ fr: "/fr/notre-histoire", en: "/en/our-story" });
    // Page du Québec seulement : l'anglais redirige, il n'est pas au plan.
    expect(par("/fr/collections")?.adresses).toEqual({ fr: "/fr/collections" });
    expect(par("/fr/vos-reperes/thc-et-cbd")?.adresses).toEqual({ fr: "/fr/vos-reperes/thc-et-cbd" });
    // Page du Canada seulement : rangée sous son adresse anglaise.
    expect(par("/en/collections/skyh")?.adresses).toEqual({ en: "/en/collections/skyh" });
    expect(pages.reduce((n, p) => n + Object.keys(p.adresses).length, 0)).toBe(12);
  });

  it("chaque page a un nom lisible et sa section, dans l'ordre des sections", () => {
    const pages = pagesDuPlan(lirePlanDuSite(PLAN));
    const par = (id: string) => pages.find((p) => p.id === id)!;
    expect(par("/fr").nom).toEqual({ fr: "Accueil", en: "Home" });
    expect(par("/fr").section).toBe("principales");
    expect(par("/fr/notre-histoire").section).toBe("histoire");
    expect(par("/en/collections/skyh")).toMatchObject({ section: "collections", nom: { fr: "Skyh", en: "Skyh" } });
    expect(par("/fr/vos-reperes/thc-et-cbd")).toMatchObject({ section: "reperes", nom: { fr: "Vos repères › THC et CBD" } });
    expect(par("/fr/varietes/blue-dream")).toMatchObject({ section: "varietes", nom: { fr: "Blue Dream" } });
    expect(par("/fr/produits/formats/fleurs")).toMatchObject({ section: "explorer", nom: { fr: "Format › Fleurs séchées" } });
    expect(par("/fr/politique-de-confidentialite").section).toBe("legales");
    expect(pages.map((p) => p.section)).toEqual([
      "principales",
      "histoire",
      "collections",
      "collections",
      "explorer",
      "reperes",
      "varietes",
      "legales",
    ]);
  });
});

describe("l'en-tête d'une page en ligne", () => {
  const HTML = `<!DOCTYPE html><html lang="fr"><head><meta charSet="utf-8"/>
<title>Notre histoire | Bleuh</title>
<meta name="description" content="Nos débuts, l&#x27;approche &amp; le savoir-faire."/>
<link rel="canonical" href="https://bleuh.co/fr/notre-histoire"/>
<meta content="https://bleuh.co/images/histoire.webp" property="og:image"/>
<meta property="og:image" content="https://bleuh.co/images/seconde.webp"/>
</head><body><svg><title>Icône</title></svg><meta name="description" content="pas celle-ci"/></body></html>`;

  it("lit titre, description, image de partage et canonique dans le <head> seulement", () => {
    expect(lireTete(HTML)).toEqual({
      title: "Notre histoire | Bleuh",
      description: "Nos débuts, l'approche & le savoir-faire.",
      ogImage: "https://bleuh.co/images/histoire.webp",
      canonical: "https://bleuh.co/fr/notre-histoire",
      robots: "",
    });
  });

  it("une page sans description le dit (chaîne vide), sans prendre celle du corps", () => {
    expect(lireTete("<html><head><title>X</title></head><body><meta name=\"description\" content=\"non\"/></body></html>").description).toBe("");
  });

  it("décode les entités courantes", () => {
    expect(decoderEntites("Contact &amp; Support &#8212; Bleuh &#x27;24 &lt;3")).toBe("Contact & Support — Bleuh '24 <3");
  });
});
