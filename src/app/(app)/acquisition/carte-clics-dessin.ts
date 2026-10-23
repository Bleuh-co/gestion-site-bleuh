/**
 * Dessin d'une carte de clics par-dessus la page rendue en direct
 * (`CartesClics.tsx`). Aucune dépendance : canvas 2D.
 *
 * ── PARTI PRIS DE LECTURE (méthode dataviz) ───────────────────────────────
 *  - La page est VOILÉE de blanc : la chaleur se lit comme un graphique sur
 *    une surface claire, quelle que soit la photo dessous.
 *  - Chaleur = rampe SÉQUENTIELLE d'une seule teinte (bleu pâle = peu, bleu
 *    foncé = beaucoup), avec une légende d'échelle. Pas d'arc-en-ciel.
 *  - Le rouge et l'orange sont RÉSERVÉS aux problèmes (couleurs de statut :
 *    clic sans effet, clics rageurs), toujours avec une icône et un libellé
 *    en légende — la couleur ne porte jamais le sens seule.
 *  - Le texte reste en encre de texte (#0b0b0b, #52514e) sur pastille
 *    blanche, jamais dans la couleur d'une série.
 *
 * Deux repères : la chaleur se dessine en pixels de la PAGE (celle du cadre,
 * mise à l'échelle) ; marqueurs, lignes et pastilles en pixels d'ÉCRAN, pour
 * garder leur taille lisible quelle que soit l'échelle.
 */

import { centreCellule, maxCellule, type CartesParBloc, type CarteFusion } from "@/lib/cartes-clics-pure";

/** Un bloc tel que mesuré par la page en mode carte (rectangle À L'ÉCRAN, en pixels de la page). */
export interface BlocMesure {
  cle: string;
  x: number;
  y: number;
  l: number;
  h: number;
  titre: string;
  /** Zone visible du conteneur qui fait défiler le bloc, s'il n'est pas la fenêtre. */
  clip?: [number, number, number, number];
}

export interface Scene {
  page: string | null;
  largeur: number;
  hauteur: number;
  defil: number;
  hauteurPage: number;
  blocs: BlocMesure[];
}

export interface Couches {
  voile: boolean;
  chaleur: boolean;
  morts: boolean;
  rages: boolean;
  defilement: boolean;
  blocs: boolean;
}

export interface PointSurvol {
  x: number;
  y: number;
  r: number;
  valeur: string;
  detail: string;
  priorite: number;
}

export interface Textes {
  vuPar: (pct: string) => string;
  voientJusquIci: (pct: string) => string;
  clics: (n: number) => string;
  morts: (n: number) => string;
  rages: (n: number) => string;
  bloc: (titre: string) => string;
}

/** Rampe séquentielle bleue (palette documentée, steps 100 → 700). */
export const RAMPE_BLEUE = [
  "#cde2fb", "#b7d3f6", "#9ec5f4", "#86b6ef", "#6da7ec", "#5598e7", "#3987e5",
  "#2a78d6", "#256abf", "#1c5cab", "#184f95", "#104281", "#0d366b",
] as const;
export const COULEUR_MORT = "#d03b3b"; // statut « critique »
export const COULEUR_RAGE = "#ec835a"; // statut « sérieux »
const ENCRE = "#0b0b0b";
const ENCRE_2 = "#52514e";
const VOILE = "rgba(252, 252, 251, 0.55)";

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

/** 256 couleurs interpolées le long de la rampe : l'index est la densité. */
const PALETTE: Uint8ClampedArray = (() => {
  const p = new Uint8ClampedArray(256 * 3);
  const pas = RAMPE_BLEUE.map(hex);
  for (let i = 0; i < 256; i++) {
    const t = (i / 255) * (pas.length - 1);
    const a = Math.floor(t);
    const b = Math.min(pas.length - 1, a + 1);
    const f = t - a;
    for (let c = 0; c < 3; c++) p[i * 3 + c] = Math.round(pas[a][c] + (pas[b][c] - pas[a][c]) * f);
  }
  return p;
})();

/** Dégradé CSS de la légende d'échelle. */
export const DEGRADE_LEGENDE = `linear-gradient(90deg, ${RAMPE_BLEUE.join(", ")})`;

function pct(part: number): string {
  return `${Math.round(part * 100)} %`;
}

function pastille(ctx: CanvasRenderingContext2D, x: number, y: number, texte: string, droite = false) {
  ctx.font = "600 12px system-ui, -apple-system, Segoe UI, sans-serif";
  const l = ctx.measureText(texte).width + 14;
  const h = 22;
  const gx = droite ? x - l : x;
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.strokeStyle = "rgba(40,40,40,0.18)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(gx, y, l, h, 11);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = droite ? ENCRE : ENCRE_2;
  ctx.textBaseline = "middle";
  ctx.fillText(texte, gx + 7, y + h / 2 + 0.5);
}

/** Le rectangle visible d'un bloc (fenêtre ∩ conteneur qui défile), en pixels de la page. */
function zoneVisible(b: BlocMesure, s: Scene): [number, number, number, number] {
  const [cx, cy, cl, ch] = b.clip ?? [0, 0, s.largeur, s.hauteur];
  const x0 = Math.max(0, cx);
  const y0 = Math.max(0, cy);
  const x1 = Math.min(s.largeur, cx + cl);
  const y1 = Math.min(s.hauteur, cy + ch);
  return [x0, y0, Math.max(0, x1 - x0), Math.max(0, y1 - y0)];
}

export interface Dessin {
  points: PointSurvol[];
  /** Clics des blocs que la page affichée ne contient plus (page modifiée depuis). */
  horsPage: number;
}

/**
 * Dessine la carte sur `canvas` (taille d'écran = largeur × échelle, hauteur
 * × échelle). Rend les points survolables, en pixels d'écran.
 */
export function dessinerCarte(
  canvas: HTMLCanvasElement,
  scene: Scene,
  fusion: CarteFusion,
  echelle: number,
  couches: Couches,
  partsBlocs: Record<string, number>,
  seuils: { part: number; palier: number }[],
  textes: Textes
): Dessin {
  const dpr = typeof window !== "undefined" ? Math.min(2, window.devicePixelRatio || 1) : 1;
  const L = Math.round(scene.largeur * echelle);
  const H = Math.round(scene.hauteur * echelle);
  if (canvas.width !== L * dpr || canvas.height !== H * dpr) {
    canvas.width = L * dpr;
    canvas.height = H * dpr;
  }
  const ctx = canvas.getContext("2d");
  const points: PointSurvol[] = [];
  if (!ctx) return { points, horsPage: 0 };
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const parCle = new Map(scene.blocs.map((b) => [b.cle, b]));
  let horsPage = 0;
  for (const [cle, cells] of Object.entries(fusion.clics)) {
    if (!parCle.has(cle)) horsPage += Object.values(cells).reduce((s, n) => s + n, 0);
  }

  // 1. Voile
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (couches.voile) {
    ctx.fillStyle = VOILE;
    ctx.fillRect(0, 0, L, H);
  }

  // 2. Chaleur — densité accumulée en niveaux de gris sur un canvas à part,
  //    puis colorisée par la rampe (une seule teinte).
  const maxClics = maxCellule(fusion.clics);
  if (couches.chaleur && maxClics > 0) {
    const tampon = document.createElement("canvas");
    tampon.width = L;
    tampon.height = H;
    const t = tampon.getContext("2d");
    if (t) {
      for (const [cle, cells] of Object.entries(fusion.clics)) {
        const b = parCle.get(cle);
        if (!b) continue;
        const [vx, vy, vl, vh] = zoneVisible(b, scene);
        if (vl <= 0 || vh <= 0) continue;
        t.save();
        t.beginPath();
        t.rect(vx * echelle, vy * echelle, vl * echelle, vh * echelle);
        t.clip();
        // Une tache couvre environ deux cases : sur un téléphone (390 px, cases
        // de 10 px) elle reste lisible ; sur un ordinateur elle est plafonnée.
        const rayon = Math.max(18, Math.min(40, (b.l / 40) * 2.2)) * echelle;
        for (const [k, n] of Object.entries(cells)) {
          const c = centreCellule(k);
          if (!c) continue;
          const x = (b.x + c.fx * b.l) * echelle;
          const y = (b.y + c.fy * b.h) * echelle;
          if (y < -rayon || y > H + rayon || x < -rayon || x > L + rayon) continue;
          const a = 0.15 + 0.85 * Math.sqrt(n / maxClics);
          const g = t.createRadialGradient(x, y, 0, x, y, rayon);
          g.addColorStop(0, `rgba(0,0,0,${a})`);
          g.addColorStop(1, "rgba(0,0,0,0)");
          t.fillStyle = g;
          t.fillRect(x - rayon, y - rayon, rayon * 2, rayon * 2);
          const visible = y >= vy * echelle && y <= (vy + vh) * echelle;
          if (visible) {
            points.push({
              x,
              y,
              r: Math.max(8, rayon * 0.6),
              valeur: textes.clics(n),
              detail: textes.bloc(b.titre || cle),
              priorite: 1,
            });
          }
        }
        t.restore();
      }
      const img = t.getImageData(0, 0, L, H);
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        const A = d[i + 3];
        if (A < 6) {
          d[i + 3] = 0;
          continue;
        }
        d[i] = PALETTE[A * 3];
        d[i + 1] = PALETTE[A * 3 + 1];
        d[i + 2] = PALETTE[A * 3 + 2];
        d[i + 3] = Math.round(255 * (0.35 + 0.6 * (A / 255)));
      }
      t.putImageData(img, 0, 0);
      ctx.drawImage(tampon, 0, 0);
    }
  }

  // 3. Blocs vus — pastille en haut à gauche de chaque bloc visible.
  if (couches.blocs) {
    for (const b of scene.blocs) {
      const part = partsBlocs[b.cle];
      if (part === undefined) continue;
      const [, vy, , vh] = zoneVisible(b, scene);
      const haut = Math.max(b.y, vy);
      if (haut > vy + vh - 30 || b.y + b.h < vy + 30) continue;
      pastille(ctx, b.x * echelle + 8, haut * echelle + 8, textes.vuPar(pct(part)));
    }
  }

  // 4. Défilement — où s'arrêtent 75 %, 50 %, 25 % des visites.
  if (couches.defilement && scene.hauteurPage > 0) {
    for (const s of seuils) {
      const y = ((s.palier / 100) * scene.hauteurPage - scene.defil) * echelle;
      if (y < 4 || y > H - 4) continue;
      ctx.save();
      ctx.strokeStyle = ENCRE_2;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(L, y);
      ctx.stroke();
      ctx.restore();
      pastille(ctx, L - 8, y - 11, textes.voientJusquIci(pct(s.part)), true);
    }
  }

  // 5. Problèmes — disques de statut, anneau blanc, icône.
  const marqueurs = (cartes: CartesParBloc, couleur: string, glyphe: string, libelle: (n: number) => string, priorite: number) => {
    for (const [cle, cells] of Object.entries(cartes)) {
      const b = parCle.get(cle);
      if (!b) continue;
      const [vx, vy, vl, vh] = zoneVisible(b, scene);
      for (const [k, n] of Object.entries(cells)) {
        const c = centreCellule(k);
        if (!c) continue;
        const px = b.x + c.fx * b.l;
        const py = b.y + c.fy * b.h;
        if (px < vx || px > vx + vl || py < vy || py > vy + vh) continue;
        const x = px * echelle;
        const y = py * echelle;
        const r = 8 + Math.min(5, Math.log2(n) * 1.5);
        ctx.beginPath();
        ctx.arc(x, y, r + 2, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = couleur;
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = `700 ${Math.round(r * 1.3)}px system-ui, -apple-system, Segoe UI, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(glyphe, x, y + 0.5);
        ctx.textAlign = "start";
        if (n >= 2) pastille(ctx, x + r + 4, y - 11, String(n));
        points.push({ x, y, r: r + 6, valeur: libelle(n), detail: textes.bloc(b.titre || cle), priorite });
      }
    }
  };
  if (couches.rages) marqueurs(fusion.rages, COULEUR_RAGE, "!", textes.rages, 2);
  if (couches.morts) marqueurs(fusion.morts, COULEUR_MORT, "×", textes.morts, 3);

  return { points, horsPage };
}

/** Le point survolé : le plus prioritaire (problèmes d'abord), puis le plus proche. */
export function pointSous(points: PointSurvol[], x: number, y: number): PointSurvol | null {
  let meilleur: PointSurvol | null = null;
  let dMeilleur = Infinity;
  for (const p of points) {
    const d = Math.hypot(p.x - x, p.y - y);
    if (d > p.r) continue;
    if (!meilleur || p.priorite > meilleur.priorite || (p.priorite === meilleur.priorite && d < dMeilleur)) {
      meilleur = p;
      dMeilleur = d;
    }
  }
  return meilleur;
}
