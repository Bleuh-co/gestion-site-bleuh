"use client";

/**
 * CARTES DE CLICS de bleuh.co — section de l'onglet Acquisition et
 * visionneuse plein écran (demande de Thierry du 23/10/2026 : voir la
 * navigation DANS une même page, et que les problèmes sautent aux yeux).
 * Même écran que celui de Maison d'Herbes (marketing-mdh, CartesClics.tsx),
 * plus la VARIANTE de région : la même adresse de bleuh.co rend la version
 * Québec ou Canada, et chacune a sa carte.
 *
 * La visionneuse rend la VRAIE page, en direct, dans un cadre de taille fixe
 * — la largeur la plus fréquente chez les visiteurs du type d'écran choisi —
 * réduit à l'échelle. La page, ouverte en mode carte (`?carte=1&region=qc|ca`,
 * site-bleuh `lib/carte-mode.ts`), mesure ses blocs et nous les envoie ; on
 * pose la carte par-dessus, bloc par bloc (`carte-clics-dessin.ts`). Le cadre
 * ne reçoit aucun clic : un calque transparent capte la molette et la lui
 * transmet.
 *
 * ⚠ Le cadre n'est JAMAIS étiré à la hauteur du document : les hauteurs en
 * `100vh` grandiraient avec lui. Il défile.
 *
 * Aucune identité nulle part : les cartes sont des compteurs par page, par
 * jour, par type d'écran et par variante (site-bleuh `lib/carte-pure.ts`),
 * pour les visiteurs qui ont accepté la mesure d'audience.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocale, useT } from "@/lib/i18n";
import {
  APPAREILS,
  LARGEUR_PAR_DEFAUT,
  calquesTries,
  hauteurPour,
  largeurDominante,
  maxCellule,
  pageAffichable,
  partsBlocs,
  partsDefilement,
  seuilsDefilement,
  totalBloc,
  type Appareil,
  type CarteFusion,
  type LignePage,
  type Variante,
} from "@/lib/cartes-clics-pure";
import {
  COULEUR_MORT,
  COULEUR_RAGE,
  DEGRADE_LEGENDE,
  dessinerCarte,
  pointSous,
  type BlocMesure,
  type Couches,
  type PointSurvol,
  type Scene,
} from "./carte-clics-dessin";

/** Teinte de marque (brand-600), comme le reste de l'écran : une seule série. */
const OR = "#8A7648";
/** Pages montrées avant « Afficher tout ». */
const PREMIERES = 15;
/** Sans nouvelles de la page après ce délai : elle ne répond pas en mode carte. */
const ATTENTE_MS = 12_000;
/** Nom des messages échangés avec bleuh.co en mode carte (`{ carte: NOM, … }`). */
const NOM = "bleuh";

export interface CarteOuverte {
  page: string;
  variante?: Variante;
  appareil?: Appareil;
}

interface Liste {
  site: string;
  pages: LignePage[];
}

/**
 * La section (liste des pages) ; la visionneuse s'ouvre par-dessus tout
 * l'écran. `ouverte` est tenue par l'écran Acquisition : le tableau des
 * frictions ouvre aussi la carte de sa page.
 */
export function CartesClics({
  query,
  ouverte,
  onOuvrir,
  onFermer,
}: {
  query: string;
  ouverte: CarteOuverte | null;
  onOuvrir: (c: CarteOuverte) => void;
  onFermer: () => void;
}) {
  const t = useT();
  const locale = useLocale();
  const nf = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const [liste, setListe] = useState<Liste | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [tout, setTout] = useState(false);

  useEffect(() => {
    let annule = false;
    setErreur(null);
    fetch(`/api/acquisition/cartes?${query}`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error || `HTTP ${res.status}`);
        return res.json() as Promise<Liste>;
      })
      .then((l) => {
        if (!annule) setListe(l);
      })
      .catch((e: Error) => {
        if (!annule) setErreur(e.message);
      });
    return () => {
      annule = true;
    };
  }, [query]);

  const pages = liste?.pages ?? [];
  const visibles = tout ? pages : pages.slice(0, PREMIERES);
  // Ouverte depuis une friction (sans variante) : la variante la plus vue de la page.
  const ligneOuverte = ouverte
    ? (pages.find((p) => p.page === ouverte.page && (!ouverte.variante || p.variante === ouverte.variante)) ?? null)
    : null;

  return (
    <section className="card p-4 mb-6">
      <h2 className="text-base font-semibold mb-1 m-0">{t("cartesClics.title")}</h2>
      <p className="text-xs text-chanv-terre/60 mb-3 m-0">{t("cartesClics.help")}</p>
      {erreur && <p className="text-sm text-red-700 m-0 mb-2">{erreur}</p>}
      <div className="table-scroll">
        <table className="table-wide text-sm">
          <thead>
            <tr className="text-left border-b border-chanv-fibre">
              <th className="py-2 pr-3">{t("cartesClics.col.page")}</th>
              <th className="py-2 px-3">{t("cartesClics.col.region")}</th>
              <th className="py-2 px-3 text-right">{t("cartesClics.col.views")}</th>
              <th className="py-2 px-3 text-right">{t("cartesClics.col.clicks")}</th>
              <th className="py-2 px-3 text-right">{t("cartesClics.col.dead")}</th>
              <th className="py-2 px-3 text-right">{t("cartesClics.col.rage")}</th>
              <th className="py-2 pl-3">{t("cartesClics.col.open")}</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((p) => (
              <tr key={`${p.variante}|${p.page}`} className="border-b border-chanv-fibre/60 last:border-0">
                <td className="py-2 pr-3 font-mono text-xs">{p.page}</td>
                <td className="py-2 px-3 text-xs">{t(`cartesClics.variante.${p.variante}`)}</td>
                <td className="py-2 px-3 text-right tabular-nums">{nf.format(p.vues)}</td>
                <td className="py-2 px-3 text-right tabular-nums">{nf.format(p.clics)}</td>
                <td className="py-2 px-3 text-right tabular-nums">{p.morts ? nf.format(p.morts) : "—"}</td>
                <td className="py-2 px-3 text-right tabular-nums">{p.rages ? nf.format(p.rages) : "—"}</td>
                <td className="py-2 pl-3">
                  <div className="flex flex-wrap gap-1">
                    {APPAREILS.filter((a) => p.appareils[a].vues > 0).map((a) => (
                      <button
                        key={a}
                        type="button"
                        className="btn btn-secondary btn-ligne"
                        onClick={() => onOuvrir({ page: p.page, variante: p.variante, appareil: a })}
                      >
                        {t("cartesClics.device.withViews", { d: t(`cartesClics.device.${a}`), n: nf.format(p.appareils[a].vues) })}
                      </button>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
            {liste && pages.length === 0 && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-chanv-terre/40">
                  {t("cartesClics.empty")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {pages.length > PREMIERES && (
        <button type="button" className="btn btn-secondary btn-ligne mt-3" onClick={() => setTout((v) => !v)}>
          {tout ? t("cartesClics.showLess") : t("cartesClics.showAll", { n: pages.length })}
        </button>
      )}
      {ouverte && liste && (
        <Visionneuse
          key={`${ouverte.variante ?? ligneOuverte?.variante ?? "qc"}|${ouverte.page}`}
          site={liste.site}
          page={ouverte.page}
          variante={ouverte.variante ?? ligneOuverte?.variante ?? (ouverte.page.startsWith("/en") ? "ca" : "qc")}
          ligne={ligneOuverte}
          appareilInitial={ouverte.appareil ?? (ligneOuverte ? appareilLePlusVu(ligneOuverte) : "telephone")}
          query={query}
          onFermer={onFermer}
        />
      )}
    </section>
  );
}

function appareilLePlusVu(l: LignePage): Appareil {
  return APPAREILS.reduce((m, a) => (l.appareils[a].vues > l.appareils[m].vues ? a : m), "telephone" as Appareil);
}

const COUCHES_PAR_DEFAUT: Couches = {
  voile: true,
  chaleur: true,
  morts: true,
  rages: true,
  defilement: true,
  blocs: true,
};

function Visionneuse({
  site,
  page,
  variante,
  ligne,
  appareilInitial,
  query,
  onFermer,
}: {
  site: string;
  page: string;
  variante: Variante;
  ligne: LignePage | null;
  appareilInitial: Appareil;
  query: string;
  onFermer: () => void;
}) {
  const t = useT();
  const locale = useLocale();
  const nf = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const pf = useMemo(() => new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 }), [locale]);

  const [appareil, setAppareil] = useState<Appareil>(appareilInitial);
  const [fusion, setFusion] = useState<CarteFusion | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [scene, setScene] = useState<Scene | null>(null);
  const [muette, setMuette] = useState(false);
  const [couches, setCouches] = useState<Couches>(COUCHES_PAR_DEFAUT);
  const [zone, setZone] = useState({ l: 900, h: 700 });
  const [survol, setSurvol] = useState<{ p: PointSurvol; x: number; y: number } | null>(null);
  const [horsPage, setHorsPage] = useState(0);

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const calqueRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<HTMLDivElement | null>(null);
  const fermerRef = useRef<HTMLButtonElement | null>(null);
  const pointsRef = useRef<PointSurvol[]>([]);
  /** Dernière position de la souris sur la carte : l'info-bulle suit le défilement. */
  const sourisRef = useRef<{ x: number; y: number } | null>(null);
  const recue = useRef(false);

  const origineSite = useMemo(() => new URL(site).origin, [site]);
  const largeur = fusion ? largeurDominante(fusion.largeurs, appareil) : LARGEUR_PAR_DEFAUT[appareil];
  const hauteur = hauteurPour(largeur);
  const echelle = Math.min(1, zone.l / largeur, zone.h / hauteur);
  const affichable = pageAffichable(page);
  // bleuh.co n'a pas de barre finale (elle redirige) ; la région est imposée
  // par le paramètre `region` (le cadre est tiers : ses témoins ne passent pas).
  const src = `${site}${page}?carte=1&region=${variante}`;

  // La carte du type d'écran choisi, jours de la période fusionnés.
  useEffect(() => {
    let annule = false;
    setChargement(true);
    setErreur(null);
    fetch(`/api/acquisition/cartes/page?page=${encodeURIComponent(page)}&appareil=${appareil}&variante=${variante}&${query}`, {
      cache: "no-store",
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error || `HTTP ${res.status}`);
        return res.json() as Promise<CarteFusion>;
      })
      .then((f) => {
        if (!annule) setFusion(f);
      })
      .catch((e: Error) => {
        if (!annule) setErreur(e.message);
      })
      .finally(() => {
        if (!annule) setChargement(false);
      });
    return () => {
      annule = true;
    };
  }, [page, appareil, variante, query]);

  // Ce que la page en mode carte nous envoie : ses blocs, à chaque défilement.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== origineSite || e.source !== iframeRef.current?.contentWindow) return;
      const d = e.data as Partial<Scene> & { carte?: string; type?: string };
      if (!d || d.carte !== NOM || d.type !== "blocs" || !Array.isArray(d.blocs)) return;
      recue.current = true;
      setMuette(false);
      setScene({
        page: typeof d.page === "string" ? d.page : null,
        largeur: Number(d.largeur) || largeur,
        hauteur: Number(d.hauteur) || hauteur,
        defil: Number(d.defil) || 0,
        hauteurPage: Number(d.hauteurPage) || 0,
        blocs: (d.blocs as BlocMesure[]).filter((b) => b && typeof b.cle === "string"),
      });
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [origineSite, largeur, hauteur]);

  // Nouvelle page ou nouvelle largeur : on attend de nouveau la page.
  useEffect(() => {
    recue.current = false;
    setScene(null);
    setMuette(false);
    const minuterie = setTimeout(() => {
      if (!recue.current) setMuette(true);
    }, ATTENTE_MS);
    return () => clearTimeout(minuterie);
  }, [src, largeur]);

  // Place disponible pour la scène.
  useEffect(() => {
    const el = sceneRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const r = e.contentRect;
      setZone({ l: Math.max(200, r.width - 32), h: Math.max(200, r.height - 64) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Échap ferme ; le focus va au bouton Fermer à l'ouverture ; l'écran
  // dessous ne défile plus tant que la visionneuse est ouverte.
  useEffect(() => {
    fermerRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFermer();
    };
    window.addEventListener("keydown", onKey);
    const avant = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = avant;
    };
  }, [onFermer]);

  const parler = (message: Record<string, unknown>) =>
    iframeRef.current?.contentWindow?.postMessage({ carte: NOM, ...message }, origineSite);

  // La molette sur la carte fait défiler la page (le cadre ne reçoit aucun geste).
  useEffect(() => {
    const el = calqueRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const unite = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? hauteur : 1;
      iframeRef.current?.contentWindow?.postMessage(
        { carte: NOM, type: "defiler", dy: (e.deltaY * unite) / echelle },
        origineSite
      );
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [echelle, hauteur, origineSite]);

  const parts = useMemo(() => (fusion ? partsDefilement(fusion.defilement, fusion.vues) : []), [fusion]);
  const seuils = useMemo(() => seuilsDefilement(parts), [parts]);
  const vusParBloc = useMemo(() => (fusion ? partsBlocs(fusion.blocs, fusion.vues) : {}), [fusion]);
  const partBas = parts.find((p) => p.palier === 100)?.part ?? 0;

  const nomBloc = (b: Pick<BlocMesure, "cle" | "titre">) =>
    b.titre || (b.cle === "entete" ? t("cartesClics.blocks.header") : b.cle === "pied" ? t("cartesClics.blocks.footer") : b.cle);

  // Dessin : à chaque message de la page (défilement), changement de carte,
  // d'échelle ou de calques.
  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !scene || !fusion) return;
    const d = dessinerCarte(c, scene, fusion, echelle, couches, vusParBloc, seuils, {
      vuPar: (p) => t("cartesClics.chip.seen", { p }),
      voientJusquIci: (p) => t("cartesClics.chip.scroll", { p }),
      clics: (n) => t("cartesClics.tip.clicks", { n: nf.format(n) }),
      morts: (n) => t("cartesClics.tip.dead", { n: nf.format(n) }),
      rages: (n) => t("cartesClics.tip.rage", { n: nf.format(n) }),
      bloc: (titre) => t("cartesClics.tip.block", { t: titre === "entete" ? t("cartesClics.blocks.header") : titre === "pied" ? t("cartesClics.blocks.footer") : titre }),
    });
    pointsRef.current = d.points;
    setHorsPage(d.horsPage);
    // La page a pu défiler sous la souris immobile : l'info-bulle suit.
    const m = sourisRef.current;
    const p = m ? pointSous(d.points, m.x, m.y) : null;
    setSurvol(p && m ? { p, x: m.x, y: m.y } : null);
  }, [scene, fusion, echelle, couches, vusParBloc, seuils, t, nf]);

  const basculer = (k: keyof Couches) => setCouches((c) => ({ ...c, [k]: !c[k] }));

  const surMouvement = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    sourisRef.current = { x, y };
    const p = pointSous(pointsRef.current, x, y);
    setSurvol(p ? { p, x, y } : null);
  };

  const Lst = largeur * echelle;
  const Hst = hauteur * echelle;

  // Rendue dans <body> : un ancêtre animé (transform) de l'écran ferait de
  // `fixed` un positionnement relatif à lui, et la visionneuse resterait
  // coincée dans la colonne de la page au lieu de couvrir l'écran.
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${t("cartesClics.title")} — ${page}`}
      className="fixed inset-0 z-[1000] flex flex-col bg-[#fcfcfb]"
    >
      <header className="flex flex-wrap items-center gap-3 border-b border-chanv-fibre bg-white px-4 py-3">
        <h2 className="m-0 text-base font-semibold">
          {t("cartesClics.title")} · <span className="font-mono text-sm">{page}</span> ·{" "}
          {t(`cartesClics.variante.${variante}`)}
        </h2>
        <div className="flex gap-1" role="group" aria-label={t("cartesClics.col.open")}>
          {APPAREILS.map((a) => {
            const vues = ligne?.appareils[a].vues;
            return (
              <button
                key={a}
                type="button"
                aria-pressed={appareil === a}
                disabled={vues === 0}
                onClick={() => setAppareil(a)}
                className={appareil === a ? "btn btn-primary btn-ligne" : "btn btn-secondary btn-ligne"}
              >
                {vues === undefined
                  ? t(`cartesClics.device.${a}`)
                  : t("cartesClics.device.withViews", { d: t(`cartesClics.device.${a}`), n: nf.format(vues) })}
              </button>
            );
          })}
        </div>
        <a
          className="btn btn-secondary btn-ligne ml-auto"
          href={`${site}${page}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t("cartesClics.openPage")}
        </a>
        <button ref={fermerRef} type="button" className="btn btn-secondary btn-ligne" onClick={onFermer}>
          {t("cartesClics.close")}
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        <div ref={sceneRef} className="flex min-w-0 flex-1 flex-col items-center justify-center overflow-hidden p-4">
          {!affichable ? (
            <p className="max-w-md text-center text-sm text-chanv-terre/70">{t("cartesClics.notDisplayable")}</p>
          ) : (
            <>
              <div className="relative overflow-hidden rounded-md bg-white shadow-chanv-bold" style={{ width: Lst, height: Hst }}>
                <iframe
                  key={`${src}-${largeur}`}
                  ref={iframeRef}
                  src={src}
                  title={page}
                  sandbox="allow-scripts allow-same-origin"
                  referrerPolicy="strict-origin-when-cross-origin"
                  tabIndex={-1}
                  style={{
                    width: largeur,
                    height: hauteur,
                    transform: `scale(${echelle})`,
                    transformOrigin: "0 0",
                    pointerEvents: "none",
                    border: 0,
                    background: "#fff",
                  }}
                />
                <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0" style={{ width: Lst, height: Hst }} />
                <div
                  ref={calqueRef}
                  className="absolute inset-0 cursor-crosshair"
                  onMouseMove={surMouvement}
                  onMouseLeave={() => {
                    sourisRef.current = null;
                    setSurvol(null);
                  }}
                />
                {survol && (
                  <div
                    role="tooltip"
                    className="pointer-events-none absolute z-10 max-w-[240px] rounded-md border border-chanv-fibre bg-white px-3 py-2 text-xs shadow-chanv-soft"
                    style={{
                      left: Math.min(survol.x + 14, Lst - 250),
                      top: Math.min(survol.y + 14, Hst - 60),
                    }}
                  >
                    <strong className="block text-sm text-chanv-terre">{survol.p.valeur}</strong>
                    <span className="text-chanv-terre/70">{survol.p.detail}</span>
                  </div>
                )}
                {(chargement || (!scene && !muette)) && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/60 text-sm text-chanv-terre/70">
                    {t("cartesClics.loading")}
                  </div>
                )}
                {muette && !scene && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/85 p-6 text-center text-sm text-chanv-terre/80">
                    {t("cartesClics.noAnswer")}
                  </div>
                )}
                {!chargement && fusion && fusion.vues === 0 && scene && (
                  <div className="absolute inset-x-4 top-4 rounded-md bg-white/95 p-3 text-center text-sm text-chanv-terre/80 shadow-chanv-soft">
                    {t("cartesClics.noData")}
                  </div>
                )}
              </div>
              <p className="m-0 mt-2 text-center text-xs text-chanv-terre/60">
                {t("cartesClics.renderedAt", { l: largeur, h: hauteur })} · {t("cartesClics.wheel")}{" "}
                <button type="button" className="underline" onClick={() => parler({ type: "aller", y: 0 })}>
                  {t("cartesClics.top")}
                </button>
              </p>
            </>
          )}
          {erreur && <p className="m-0 mt-2 text-sm text-red-700">{erreur}</p>}
        </div>

        <aside className="w-[340px] shrink-0 overflow-y-auto border-l border-chanv-fibre bg-white p-4 pb-24 text-sm">
          <div className="mb-4 grid grid-cols-2 gap-2">
            <Chiffre libelle={t("cartesClics.kpi.views")} valeur={fusion ? nf.format(fusion.vues) : "—"} />
            <Chiffre libelle={t("cartesClics.kpi.clicks")} valeur={fusion ? nf.format(fusion.nClics) : "—"} />
            <Chiffre libelle={t("cartesClics.kpi.dead")} valeur={fusion ? nf.format(fusion.nMorts) : "—"} />
            <Chiffre libelle={t("cartesClics.kpi.bottom")} valeur={fusion && fusion.vues ? pf.format(partBas) : "—"} />
          </div>

          <h3 className="label mb-2">{t("cartesClics.layers")}</h3>
          <div className="mb-4 flex flex-wrap gap-1">
            {(Object.keys(COUCHES_PAR_DEFAUT) as (keyof Couches)[]).map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={couches[k]}
                onClick={() => basculer(k)}
                className={couches[k] ? "btn btn-primary btn-ligne" : "btn btn-secondary btn-ligne"}
              >
                {t(`cartesClics.layer.${k}`)}
              </button>
            ))}
          </div>

          <h3 className="label mb-2">{t("cartesClics.legend")}</h3>
          <ul className="mb-4 space-y-2 p-0 text-xs text-chanv-terre/80" style={{ listStyle: "none" }}>
            <li>
              <span className="mb-1 block h-2.5 w-full rounded-full" style={{ background: DEGRADE_LEGENDE }} aria-hidden="true" />
              {t("cartesClics.legend.heat", { n: fusion ? nf.format(maxCellule(fusion.clics)) : "—" })}
            </li>
            <li className="flex items-center gap-2">
              <Marqueur couleur={COULEUR_MORT} glyphe="×" />
              {t("cartesClics.legend.dead")}
            </li>
            <li className="flex items-center gap-2">
              <Marqueur couleur={COULEUR_RAGE} glyphe="!" />
              {t("cartesClics.legend.rage")}
            </li>
            <li className="flex items-center gap-2">
              <svg width="22" height="10" aria-hidden="true">
                <line x1="0" y1="5" x2="22" y2="5" stroke="#52514e" strokeWidth="2" strokeDasharray="6 5" />
              </svg>
              {t("cartesClics.legend.scroll")}
            </li>
          </ul>

          <h3 className="label mb-2">{t("cartesClics.scroll.title")}</h3>
          <ul className="mb-4 space-y-1 p-0" style={{ listStyle: "none" }}>
            {parts
              .filter((p) => p.palier > 0 && p.palier % 10 === 0)
              .map((p) => (
                <li key={p.palier} className="flex items-center gap-2 text-xs">
                  <span className="w-24 shrink-0 text-chanv-terre/70">{t("cartesClics.scroll.row", { p: `${p.palier} %` })}</span>
                  <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-chanv-fibre" aria-hidden="true">
                    <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.round(p.part * 100)}%`, background: OR }} />
                  </span>
                  <span className="w-10 shrink-0 text-right tabular-nums text-chanv-terre">{pf.format(p.part)}</span>
                </li>
              ))}
          </ul>

          <h3 className="label mb-2">{t("cartesClics.blocks.title")}</h3>
          <table className="mb-4 w-full text-xs">
            <thead>
              <tr className="border-b border-chanv-fibre text-left">
                <th className="py-1 pr-2 font-medium">{t("cartesClics.col.page")}</th>
                <th className="px-2 py-1 text-right font-medium">{t("cartesClics.blocks.seen")}</th>
                <th className="px-2 py-1 text-right font-medium">{t("cartesClics.col.clicks")}</th>
                <th className="py-1 pl-2" />
              </tr>
            </thead>
            <tbody>
              {(scene?.blocs ?? []).map((b) => (
                <tr key={b.cle} className="border-b border-chanv-fibre/60 last:border-0">
                  <td className="max-w-[140px] truncate py-1 pr-2" title={b.cle}>
                    {nomBloc(b)}
                  </td>
                  <td className="px-2 py-1 text-right tabular-nums">
                    {vusParBloc[b.cle] !== undefined ? pf.format(vusParBloc[b.cle]) : "—"}
                  </td>
                  <td className="px-2 py-1 text-right tabular-nums">{fusion ? nf.format(totalBloc(fusion.clics, b.cle)) : "—"}</td>
                  <td className="py-1 pl-2 text-right">
                    <button
                      type="button"
                      className="underline"
                      onClick={() => scene && parler({ type: "aller", y: Math.max(0, b.y + scene.defil - 16) })}
                    >
                      {t("cartesClics.blocks.go")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {horsPage > 0 && (
            <p className="mb-4 rounded-md bg-chanv-fibre/60 p-2 text-xs text-chanv-terre/80">
              {t("cartesClics.misplaced", { n: nf.format(horsPage) })}
            </p>
          )}

          <h3 className="label mb-1">{t("cartesClics.outside.title")}</h3>
          <p className="m-0 mb-2 text-xs text-chanv-terre/60">{t("cartesClics.outside.help")}</p>
          {fusion && calquesTries(fusion.calques).length > 0 ? (
            <ul className="space-y-1 p-0" style={{ listStyle: "none" }}>
              {calquesTries(fusion.calques).map((c) => (
                <li key={c.libelle} className="flex justify-between gap-2 text-xs">
                  <span className="truncate font-mono" title={c.libelle}>
                    {c.libelle}
                  </span>
                  <span className="tabular-nums">{nf.format(c.n)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="m-0 text-xs text-chanv-terre/40">{t("cartesClics.outside.empty")}</p>
          )}
        </aside>
      </div>
    </div>,
    document.body
  );
}

function Chiffre({ libelle, valeur }: { libelle: string; valeur: string }) {
  return (
    <div className="rounded-md border border-chanv-fibre p-2">
      <p className="label m-0 mb-0.5">{libelle}</p>
      <p className="m-0 text-lg font-bold tabular-nums">{valeur}</p>
    </div>
  );
}

function Marqueur({ couleur, glyphe }: { couleur: string; glyphe: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" className="shrink-0">
      <circle cx="10" cy="10" r="9" fill="#ffffff" />
      <circle cx="10" cy="10" r="7.5" fill={couleur} />
      <text x="10" y="10.5" textAnchor="middle" dominantBaseline="middle" fontSize="11" fontWeight="700" fill="#ffffff">
        {glyphe}
      </text>
    </svg>
  );
}
