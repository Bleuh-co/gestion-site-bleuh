/**
 * CARTES DE CLICS de bleuh.co — lecture (onglet Acquisition).
 *
 * Le site compte, page par page, par type d'écran ET par variante de région
 * (Québec / Canada : la même adresse rend deux mises en page), où l'on clique
 * dans chaque bloc, jusqu'où l'on descend et quels blocs on voit (site-bleuh,
 * `src/lib/carte-pure.ts` : le modèle et ce qu'il ne garde PAS — aucune
 * identité, des compteurs par jour ; comme le reste de la mesure de bleuh.co,
 * seulement pour les visiteurs qui ont accepté la mesure d'audience). Ce
 * module fusionne les jours d'une période et prépare ce que l'écran dessine
 * par-dessus la page rendue en direct (`CartesClics.tsx`).
 *
 * ⚠ DUPLICATION ASSUMÉE, comme le reste de l'acquisition : les constantes de
 * la grille, les types d'écran et l'identifiant de document sont recopiés de
 * site-bleuh (les deux dépôts se déploient séparément). Un test épingle
 * l'identifiant de document sur des valeurs relevées côté site. Même modèle
 * que les cartes de Maison d'Herbes (marketing-mdh, cartes-clics-pure.ts).
 */

export const APPAREILS = ["telephone", "tablette", "ordinateur"] as const;
export type Appareil = (typeof APPAREILS)[number];

/** Variante de région : la même adresse rend la version Québec ou Canada. */
export const VARIANTES = ["qc", "ca"] as const;
export type Variante = (typeof VARIANTES)[number];

export function estVariante(v: unknown): v is Variante {
  return typeof v === "string" && (VARIANTES as readonly string[]).includes(v);
}

export function estAppareil(v: unknown): v is Appareil {
  return typeof v === "string" && (APPAREILS as readonly string[]).includes(v);
}

/** Mêmes seuils que le site (`appareilDe`) : sous 768 px, jusqu'à 1279 px, au-delà. */
export function appareilDe(largeur: number): Appareil {
  if (!(largeur > 0)) return "ordinateur";
  if (largeur < 768) return "telephone";
  if (largeur < 1280) return "tablette";
  return "ordinateur";
}

/** 40 colonnes, 100 rangées par bloc — comme le site. */
export const GRILLE = { colonnes: 40, rangees: 100 } as const;

export const LARGEUR_PAR_DEFAUT: Record<Appareil, number> = {
  telephone: 390,
  tablette: 1024,
  ordinateur: 1440,
};

/**
 * Hauteur de la fenêtre rendue pour une largeur : un téléphone en portrait
 * (390 × 844), une tablette en portrait jusqu'à 900 px de large et à
 * l'horizontale au-delà, un ordinateur en 16/10 plafonné à 1000 px.
 *
 * ⚠ La page est rendue dans une fenêtre de TAILLE FIXE qui défile, jamais
 * étirée à la hauteur du document : les hauteurs en `100vh` (héros de
 * l'accueil) grandiraient avec elle, et les mises en page qui dépendent de
 * la hauteur basculeraient.
 */
export function hauteurPour(largeur: number): number {
  if (largeur < 768) return Math.round(largeur * 2.164);
  if (largeur <= 900) return Math.round(largeur * 1.4);
  if (largeur < 1280) return Math.round(largeur * 0.7);
  return Math.min(1000, Math.round(largeur * 0.625));
}

// ---------------------------------------------------------------------------
// Identifiant de document — recopié de site-bleuh (traffic-pure.ts, carte-pure.ts)
// ---------------------------------------------------------------------------

function slug(value: string, maxLen: number): string {
  const s = value
    .toLowerCase()
    .replace(/[^a-z0-9._~:-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLen);
  return s === "" || s === "." || s === ".." ? "-" : s;
}

/** `pageDocId` de site-bleuh (`traffic-pure.ts`), à l'identique. */
export function pageDocId(path: string): string {
  const id = path
    .split("/")
    .filter((seg) => seg !== "")
    .map((seg) => slug(seg, 48))
    .join("~")
    .slice(0, 120);
  return id === "" ? "racine" : id;
}

/** `site_traffic/{jour}/cartes/{carteDocId}` — un document par type d'écran, variante et page. */
export function carteDocId(appareil: Appareil, variante: Variante, page: string): string {
  return `${appareil}_${variante}_${pageDocId(page)}`;
}

// ---------------------------------------------------------------------------
// Fusion des jours
// ---------------------------------------------------------------------------

/** Un document `cartes` tel que lu — rien n'y est cru sans conversion. */
export interface CarteDoc {
  page?: unknown;
  appareil?: unknown;
  variante?: unknown;
  vues?: unknown;
  largeurs?: unknown;
  defilement?: unknown;
  blocs?: unknown;
  clics?: unknown;
  morts?: unknown;
  rages?: unknown;
  calques?: unknown;
  n_clics?: unknown;
  n_morts?: unknown;
  n_rages?: unknown;
}

export type CartesParBloc = Record<string, Record<string, number>>;

export interface CarteFusion {
  page: string;
  appareil: Appareil;
  variante: Variante;
  /** Jours de la période qui ont au moins un document. */
  jours: number;
  vues: number;
  largeurs: Record<string, number>;
  /** Vues par palier de défilement atteint (`p0` … `p100`). */
  defilement: Record<string, number>;
  /** Vues où le bloc a été vu. */
  blocs: Record<string, number>;
  clics: CartesParBloc;
  morts: CartesParBloc;
  rages: CartesParBloc;
  calques: Record<string, number>;
  nClics: number;
  nMorts: number;
  nRages: number;
}

const nombre = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

function sommerPlat(cible: Record<string, number>, source: unknown): void {
  if (!source || typeof source !== "object") return;
  for (const [k, v] of Object.entries(source as Record<string, unknown>)) {
    const n = nombre(v);
    if (n) cible[k] = (cible[k] ?? 0) + n;
  }
}

const CELLULE = /^(\d{1,2})_(\d{1,2})$/;

function sommerCellules(cible: CartesParBloc, source: unknown): void {
  if (!source || typeof source !== "object") return;
  for (const [bloc, cells] of Object.entries(source as Record<string, unknown>)) {
    if (!cells || typeof cells !== "object") continue;
    for (const [k, v] of Object.entries(cells as Record<string, unknown>)) {
      const m = CELLULE.exec(k);
      if (!m || Number(m[1]) >= GRILLE.colonnes || Number(m[2]) >= GRILLE.rangees) continue;
      const n = nombre(v);
      if (n > 0) (cible[bloc] ??= {})[k] = (cible[bloc][k] ?? 0) + n;
    }
  }
}

export function fusionnerCartes(page: string, appareil: Appareil, variante: Variante, docs: CarteDoc[]): CarteFusion {
  const f: CarteFusion = {
    page,
    appareil,
    variante,
    jours: docs.length,
    vues: 0,
    largeurs: {},
    defilement: {},
    blocs: {},
    clics: {},
    morts: {},
    rages: {},
    calques: {},
    nClics: 0,
    nMorts: 0,
    nRages: 0,
  };
  for (const d of docs) {
    f.vues += nombre(d.vues);
    sommerPlat(f.largeurs, d.largeurs);
    sommerPlat(f.defilement, d.defilement);
    sommerPlat(f.blocs, d.blocs);
    sommerCellules(f.clics, d.clics);
    sommerCellules(f.morts, d.morts);
    sommerCellules(f.rages, d.rages);
    sommerPlat(f.calques, d.calques);
    f.nClics += nombre(d.n_clics);
    f.nMorts += nombre(d.n_morts);
    f.nRages += nombre(d.n_rages);
  }
  return f;
}

// ---------------------------------------------------------------------------
// Liste des pages
// ---------------------------------------------------------------------------

export interface CompteAppareil {
  vues: number;
  clics: number;
  morts: number;
  rages: number;
}

export interface LignePage {
  page: string;
  variante: Variante;
  vues: number;
  clics: number;
  morts: number;
  rages: number;
  appareils: Record<Appareil, CompteAppareil>;
}

const vide = (): CompteAppareil => ({ vues: 0, clics: 0, morts: 0, rages: 0 });

/**
 * Les documents d'une période (champs de tête seulement) → une ligne par page
 * ET par variante (Québec et Canada n'ont pas la même mise en page), les plus
 * vues d'abord.
 */
export function listerPages(docs: CarteDoc[]): LignePage[] {
  const parPage = new Map<string, LignePage>();
  for (const d of docs) {
    if (typeof d.page !== "string" || !estAppareil(d.appareil) || !estVariante(d.variante)) continue;
    const cle = `${d.variante}|${d.page}`;
    let l = parPage.get(cle);
    if (!l) {
      l = {
        page: d.page,
        variante: d.variante,
        vues: 0,
        clics: 0,
        morts: 0,
        rages: 0,
        appareils: { telephone: vide(), tablette: vide(), ordinateur: vide() },
      };
      parPage.set(cle, l);
    }
    const a = l.appareils[d.appareil];
    const vues = nombre(d.vues);
    const clics = nombre(d.n_clics);
    const morts = nombre(d.n_morts);
    const rages = nombre(d.n_rages);
    a.vues += vues;
    a.clics += clics;
    a.morts += morts;
    a.rages += rages;
    l.vues += vues;
    l.clics += clics;
    l.morts += morts;
    l.rages += rages;
  }
  return [...parPage.values()].sort(
    (a, b) => b.vues - a.vues || b.clics - a.clics || a.page.localeCompare(b.page) || a.variante.localeCompare(b.variante)
  );
}

/** Type d'écran à montrer d'abord : celui qui a le plus de vues. */
export function appareilPrincipal(l: Pick<LignePage, "appareils">): Appareil {
  return APPAREILS.reduce((m, a) => (l.appareils[a].vues > l.appareils[m].vues ? a : m), "telephone" as Appareil);
}

// ---------------------------------------------------------------------------
// Ce que l'écran dessine
// ---------------------------------------------------------------------------

/**
 * Largeur à laquelle rendre la page : la plus fréquente chez les visiteurs de
 * ce type d'écran (« ce que voit la majorité »), sinon la largeur type.
 */
export function largeurDominante(largeurs: Record<string, number>, appareil: Appareil): number {
  let meilleure = 0;
  let n = 0;
  for (const [k, v] of Object.entries(largeurs)) {
    const l = Number(k);
    if (!Number.isInteger(l) || appareilDe(l) !== appareil) continue;
    if (v > n || (v === n && Math.abs(l - LARGEUR_PAR_DEFAUT[appareil]) < Math.abs(meilleure - LARGEUR_PAR_DEFAUT[appareil]))) {
      meilleure = l;
      n = v;
    }
  }
  return meilleure || LARGEUR_PAR_DEFAUT[appareil];
}

export interface PartPalier {
  palier: number;
  /** Part des vues qui ont vu la page au moins jusqu'à ce palier (0 à 1). */
  part: number;
}

/** Part des vues qui atteignent chaque palier (0, 5 … 100 %), cumulée depuis le bas. */
export function partsDefilement(defilement: Record<string, number>, vues: number): PartPalier[] {
  const parPalier = new Map<number, number>();
  let total = 0;
  for (const [k, v] of Object.entries(defilement)) {
    const m = /^p(\d{1,3})$/.exec(k);
    if (!m) continue;
    const p = Number(m[1]);
    const n = Math.max(0, nombre(v));
    if (p > 100 || p % 5 !== 0 || !n) continue;
    parPalier.set(p, (parPalier.get(p) ?? 0) + n);
    total += n;
  }
  const base = Math.max(total, vues);
  if (!base) return [];
  const out: PartPalier[] = [];
  let cumul = 0;
  for (let p = 100; p >= 0; p -= 5) {
    cumul += parPalier.get(p) ?? 0;
    out.push({ palier: p, part: cumul / base });
  }
  return out.reverse();
}

/**
 * Où tracer les lignes « 75 %, 50 %, 25 % des visites voient jusqu'ici » : le
 * palier le plus bas que cette part des vues atteint encore.
 */
export function seuilsDefilement(parts: PartPalier[], seuils: number[] = [0.75, 0.5, 0.25]): { part: number; palier: number }[] {
  const out: { part: number; palier: number }[] = [];
  for (const s of seuils) {
    let palier = -1;
    for (const p of parts) if (p.part >= s) palier = p.palier;
    if (palier > 0 && palier < 100) out.push({ part: s, palier });
  }
  return out;
}

/** Part des vues où chaque bloc a été vu. */
export function partsBlocs(blocs: Record<string, number>, vues: number): Record<string, number> {
  if (!vues) return {};
  return Object.fromEntries(Object.entries(blocs).map(([k, n]) => [k, Math.min(1, n / vues)]));
}

/** Le plus gros compte d'une cellule — la référence de l'échelle de chaleur. */
export function maxCellule(cartes: CartesParBloc): number {
  let m = 0;
  for (const cells of Object.values(cartes)) for (const n of Object.values(cells)) if (n > m) m = n;
  return m;
}

/** Centre d'une cellule, en fractions du bloc. */
export function centreCellule(cle: string): { fx: number; fy: number } | null {
  const m = CELLULE.exec(cle);
  if (!m) return null;
  return { fx: (Number(m[1]) + 0.5) / GRILLE.colonnes, fy: (Number(m[2]) + 0.5) / GRILLE.rangees };
}

/** Somme des comptes d'un bloc. */
export function totalBloc(cartes: CartesParBloc, bloc: string): number {
  return Object.values(cartes[bloc] ?? {}).reduce((s, n) => s + n, 0);
}

/** Calques les plus cliqués (tiroirs, fenêtres, volets du menu). */
export function calquesTries(calques: Record<string, number>, n = 12): { libelle: string; n: number }[] {
  return Object.entries(calques)
    .map(([libelle, k]) => ({ libelle, n: k }))
    .sort((a, b) => b.n - a.n || a.libelle.localeCompare(b.libelle))
    .slice(0, n);
}

/** Page affichable en direct : pas de segment réduit (`:id`), qu'aucune adresse ne désigne. */
export function pageAffichable(page: string): boolean {
  return page.startsWith("/") && !page.split("/").includes(":id");
}
