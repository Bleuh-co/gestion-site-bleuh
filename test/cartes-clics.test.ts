/**
 * Cartes de clics de bleuh.co (onglet Acquisition, 23/10/2026) — fusion des
 * jours, liste des pages par variante de région, ce que l'écran dessine, et
 * l'identifiant de document recopié de site-bleuh (s'il divergeait, l'écran
 * lirait des documents qui n'existent pas).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  appareilDe,
  calquesTries,
  carteDocId,
  fusionnerCartes,
  hauteurPour,
  largeurDominante,
  listerPages,
  maxCellule,
  pageAffichable,
  pageDocId,
  partsBlocs,
  partsDefilement,
  seuilsDefilement,
  totalBloc,
} from "../src/lib/cartes-clics-pure";

const src = (rel: string) => readFileSync(resolve(__dirname, "..", rel), "utf8");

describe("identifiant de document — le même que site-bleuh", () => {
  it("type d'écran, variante, puis la page (pageDocId de site-bleuh)", () => {
    expect(carteDocId("telephone", "qc", "/fr/produits")).toBe("telephone_qc_fr~produits");
    expect(carteDocId("ordinateur", "ca", "/en")).toBe("ordinateur_ca_en");
    expect(carteDocId("ordinateur", "qc", "/")).toBe("ordinateur_qc_racine");
    expect(pageDocId("/mon-compte/commandes/:id")).toBe("mon-compte~commandes~:id");
    expect(pageDocId("/en/product/crème")).toBe("en~product~cr-me");
  });
});

describe("fusion des jours", () => {
  const jour1 = {
    page: "/",
    appareil: "telephone",
    vues: 10,
    largeurs: { "390": 6, "430": 4 },
    defilement: { p40: 4, p100: 6 },
    blocs: { entete: 10, "section.a": 7 },
    clics: { entete: { "3_40": 5 }, "section.a": { "20_50": 2 } },
    morts: { entete: { "3_40": 1 } },
    calques: { "→ /panier": 3 },
    n_clics: 7,
    n_morts: 1,
  };
  const jour2 = {
    page: "/",
    appareil: "telephone",
    vues: 5,
    largeurs: { "390": 5 },
    defilement: { p40: 1, p100: 4 },
    blocs: { entete: 5 },
    clics: { entete: { "3_40": 1, "99_1": 9, pasunecle: 3 } },
    n_clics: 1,
  };

  it("somme vues, largeurs, paliers, blocs, cellules et calques ; ignore les cellules hors grille", () => {
    const f = fusionnerCartes("/", "telephone", "qc", [jour1, jour2]);
    expect(f.jours).toBe(2);
    expect(f.vues).toBe(15);
    expect(f.largeurs).toEqual({ "390": 11, "430": 4 });
    expect(f.defilement).toEqual({ p40: 5, p100: 10 });
    expect(f.blocs).toEqual({ entete: 15, "section.a": 7 });
    expect(f.clics).toEqual({ entete: { "3_40": 6 }, "section.a": { "20_50": 2 } });
    expect(f.morts).toEqual({ entete: { "3_40": 1 } });
    expect(f.calques).toEqual({ "→ /panier": 3 });
    expect(f.nClics).toBe(8);
    expect(maxCellule(f.clics)).toBe(6);
    expect(totalBloc(f.clics, "entete")).toBe(6);
  });

  it("liste les pages par variante, les plus vues d'abord, par type d'écran", () => {
    const l = listerPages([
      { page: "/fr", appareil: "telephone", variante: "qc", vues: 10, n_clics: 7, n_morts: 1 },
      { page: "/fr", appareil: "ordinateur", variante: "qc", vues: 3, n_clics: 2 },
      { page: "/fr", appareil: "telephone", variante: "ca", vues: 2 },
      { page: "/fr/produits", appareil: "telephone", variante: "qc", vues: 20, n_clics: 1, n_rages: 2 },
      { page: "/x", appareil: "montre", variante: "qc", vues: 99 },
      { page: "/y", appareil: "telephone", variante: "on", vues: 99 },
    ]);
    expect(l.map((p) => `${p.variante} ${p.page}`)).toEqual(["qc /fr/produits", "qc /fr", "ca /fr"]);
    expect(l[1].vues).toBe(13);
    expect(l[1].appareils.telephone).toEqual({ vues: 10, clics: 7, morts: 1, rages: 0 });
    expect(l[1].appareils.ordinateur.vues).toBe(3);
    expect(l[0].rages).toBe(2);
  });
});

describe("ce que l'écran dessine", () => {
  it("rend la page à la largeur la plus fréquente du type d'écran", () => {
    expect(largeurDominante({ "390": 11, "430": 4, "1440": 50 }, "telephone")).toBe(390);
    expect(largeurDominante({ "1440": 3, "1920": 7 }, "ordinateur")).toBe(1920);
    expect(largeurDominante({}, "tablette")).toBe(1024);
    expect(appareilDe(1194)).toBe("tablette");
  });

  it("une fenêtre de taille fixe, proportionnée au type d'écran", () => {
    expect(hauteurPour(390)).toBe(844);
    expect(hauteurPour(820)).toBe(1148);
    expect(hauteurPour(1194)).toBe(836);
    expect(hauteurPour(1440)).toBe(900);
    expect(hauteurPour(1920)).toBe(1000);
  });

  it("part des vues qui atteint chaque palier, et les lignes à 75 / 50 / 25 %", () => {
    // 10 vues : 2 s'arrêtent à 20 %, 3 à 50 %, 5 vont en bas.
    const parts = partsDefilement({ p20: 2, p50: 3, p100: 5 }, 10);
    const a = (p: number) => parts.find((x) => x.palier === p)!.part;
    expect(a(0)).toBe(1);
    expect(a(20)).toBe(1);
    expect(a(25)).toBe(0.8);
    expect(a(50)).toBe(0.8);
    expect(a(55)).toBe(0.5);
    expect(a(100)).toBe(0.5);
    expect(seuilsDefilement(parts)).toEqual([
      { part: 0.75, palier: 50 },
      // 50 % et 25 % atteignent le bas : pas de ligne à 100 %.
    ]);
  });

  it("part des vues où chaque bloc est vu, bornée à 100 %", () => {
    expect(partsBlocs({ entete: 10, "section.a": 4, drole: 12 }, 10)).toEqual({ entete: 1, "section.a": 0.4, drole: 1 });
    expect(partsBlocs({ entete: 3 }, 0)).toEqual({});
  });

  it("les calques les plus cliqués d'abord", () => {
    expect(calquesTries({ "→ /a": 2, "→ /b": 9, "button « Fermer »": 2 })).toEqual([
      { libelle: "→ /b", n: 9 },
      // À égalité, l'ordre alphabétique de la locale (le symbole d'abord).
      { libelle: "→ /a", n: 2 },
      { libelle: "button « Fermer »", n: 2 },
    ]);
  });

  it("une page à numéro réduit ne se rend pas en direct", () => {
    expect(pageAffichable("/produit/creme")).toBe(true);
    expect(pageAffichable("/mon-compte/commandes/:id")).toBe(false);
  });
});

describe("câblage de la visionneuse", () => {
  const tsx = src("src/app/(app)/acquisition/CartesClics.tsx");

  it("n'écoute que la page qu'elle a ouverte, à son origine", () => {
    expect(tsx).toContain("e.origin !== origineSite || e.source !== iframeRef.current?.contentWindow");
  });

  it("impose la région par l'adresse du cadre (le cadre est tiers : pas de témoin)", () => {
    expect(tsx).toContain("?carte=1&region=${variante}");
  });

  it("ne parle à la page qu'à son origine, jamais à « * »", () => {
    expect(tsx).not.toMatch(/postMessage\([^)]*["']\*["']/);
    expect(tsx.match(/postMessage\(/g)!.length).toBe(2);
    expect(tsx.match(/origineSite\s*\)/g)!.length).toBeGreaterThanOrEqual(2);
  });

  it("le cadre ne reçoit aucun geste, est cloisonné, et garde une taille fixe", () => {
    expect(tsx).toContain('pointerEvents: "none"');
    expect(tsx).toContain('sandbox="allow-scripts allow-same-origin"');
    expect(tsx).toContain("height: hauteur,");
    expect(tsx).toContain("transform: `scale(${echelle})`");
  });

  it("les routes de lecture exigent une session", () => {
    for (const r of ["src/app/api/acquisition/cartes/route.ts", "src/app/api/acquisition/cartes/page/route.ts"]) {
      expect(src(r)).toContain("await requireRead();");
    }
  });
});
