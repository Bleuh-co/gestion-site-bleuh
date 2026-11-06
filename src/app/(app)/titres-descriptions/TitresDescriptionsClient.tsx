"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ExternalLink, Pencil, Search } from "lucide-react";
import { useLocale, useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/types";
import { REPERE_DESCRIPTION, REPERE_TITRE, cleDeChemin, type Langue, type ReglageEcrit } from "@/lib/seo-reglages-pure";
import { SECTIONS_SEO, type PageSeo, type SectionSeo } from "@/lib/seo-pages-pure";
import type { ReglageAffiche } from "@/lib/seo-reglages-store";
import type { TeteLue, TeteOk } from "@/lib/bleuh-co-en-ligne";

/**
 * TITRES ET DESCRIPTIONS — le titre et la description que Google affiche pour
 * chaque page de bleuh.co, réglables adresse par adresse (demande de Daphnée
 * du 06/11/2026 ; même principe que Pages, Blogue et Centre d'aide dans
 * Marketing MDH).
 *
 * La liste vient du plan du site de bleuh.co ; chaque cellule montre ce que
 * la page dit à Google EN CE MOMENT (lu comme un robot), ou le réglage posé
 * ici. Un champ vide garde le texte du site : l'écran le montre au lieu d'un
 * vide. GET /api/site/seo, GET /api/site/seo/en-ligne, PUT /api/site/seo/[cle].
 */

interface Donnees {
  base: string;
  pages: PageSeo[];
  reglages: Record<string, ReglageAffiche>;
  planLuLe: string;
}

type Tetes = Record<string, TeteLue | "chargement">;

const LANGUES: Langue[] = ["fr", "en"];
/** Adresses lues par appel : l'écran les demande par paquets, deux à la fois. */
const PAQUET = 12;

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api/site/seo${path}`, { cache: "no-store", ...init });
  const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok || !data || data.success === false) {
    throw new Error((data?.message as string) || (data?.error as string) || `Erreur ${res.status}`);
  }
  return data as T;
}

function teteLisible(t: TeteLue | "chargement" | undefined): TeteOk | null {
  return t && t !== "chargement" && "title" in t ? t : null;
}

function imageValide(v: string): boolean {
  if (!v.trim()) return true;
  try {
    return new URL(v.trim()).protocol === "https:";
  } catch {
    return false;
  }
}

export function TitresDescriptionsClient({ role }: { role: Role }) {
  const t = useT();
  const locale = useLocale();
  const langueUi: Langue = locale.startsWith("fr") ? "fr" : "en";
  const canWrite = role === "gestionnaire" || role === "admin" || role === "superadmin";

  const [donnees, setDonnees] = useState<Donnees | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [tetes, setTetes] = useState<Tetes>({});
  const demandees = useRef(new Set<string>());
  const [recherche, setRecherche] = useState("");
  const [section, setSection] = useState<SectionSeo | "toutes">("toutes");
  const [seulementReglees, setSeulementReglees] = useState(false);
  const [ouvertes, setOuvertes] = useState<Set<SectionSeo>>(() => new Set(SECTIONS_SEO.filter((s) => s !== "varietes")));
  const [edition, setEdition] = useState<string | null>(null);

  useEffect(() => {
    api<Donnees>("")
      .then(setDonnees)
      .catch((e: unknown) => setErreur(e instanceof Error ? e.message : String(e)));
  }, []);

  /** Lit l'en-tête en ligne de ces adresses, par paquets ; rend ce qui a été lu. */
  const lireTetes = useCallback(async (chemins: string[], frais = false): Promise<Record<string, TeteLue>> => {
    const lus: Record<string, TeteLue> = {};
    if (!chemins.length) return lus;
    chemins.forEach((c) => demandees.current.add(c));
    setTetes((avant) => ({ ...avant, ...Object.fromEntries(chemins.map((c) => [c, avant[c] ?? "chargement"])) }));
    const paquets: string[][] = [];
    for (let i = 0; i < chemins.length; i += PAQUET) paquets.push(chemins.slice(i, i + PAQUET));
    let suivant = 0;
    const ouvrier = async () => {
      while (suivant < paquets.length) {
        const paquet = paquets[suivant++];
        try {
          const q = `?chemins=${encodeURIComponent(paquet.join(","))}${frais ? "&frais=1" : ""}`;
          const r = await api<{ tetes: Record<string, TeteLue> }>(`/en-ligne${q}`);
          Object.assign(lus, r.tetes);
          setTetes((avant) => ({ ...avant, ...r.tetes }));
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          const echec = Object.fromEntries(paquet.map((c) => [c, { statut: 0, erreur: message } as TeteLue]));
          setTetes((avant) => ({ ...avant, ...echec }));
        }
      }
    };
    await Promise.all([ouvrier(), ouvrier()]);
    return lus;
  }, []);

  const filtrees = useMemo(() => {
    if (!donnees) return [];
    const q = recherche
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "");
    return donnees.pages.filter((p) => {
      if (section !== "toutes" && p.section !== section) return false;
      if (seulementReglees && !LANGUES.some((l) => p.adresses[l] && donnees.reglages[cleDeChemin(p.adresses[l]!)])) {
        return false;
      }
      if (!q) return true;
      const foin = [p.nom.fr, p.nom.en, p.adresses.fr ?? "", p.adresses.en ?? ""]
        .join(" ")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "");
      return foin.includes(q);
    });
  }, [donnees, recherche, section, seulementReglees]);

  const recherchant = recherche.trim().length > 0 || section !== "toutes" || seulementReglees;
  const visibles = useMemo(
    () => filtrees.filter((p) => recherchant || ouvertes.has(p.section)),
    [filtrees, ouvertes, recherchant],
  );

  // Ce que Google voit, pour les pages affichées : lu une fois, au fil de l'affichage.
  useEffect(() => {
    const manquants = visibles.flatMap((p) => LANGUES.map((l) => p.adresses[l])).filter(
      (c): c is string => !!c && !demandees.current.has(c),
    );
    if (manquants.length) void lireTetes(manquants);
  }, [visibles, lireTetes]);

  const pageEditee = edition && donnees ? donnees.pages.find((p) => p.id === edition) ?? null : null;

  if (erreur) {
    return (
      <main className="mx-auto max-w-6xl p-6">
        <div className="card p-6 text-sm text-red-700">{erreur}</div>
      </main>
    );
  }
  if (!donnees) {
    return (
      <main className="mx-auto max-w-6xl p-6">
        <p className="text-sm text-chanv-terre/60">{t("td.chargement")}</p>
      </main>
    );
  }

  if (pageEditee) {
    return (
      <EditeurPage
        key={pageEditee.id}
        page={pageEditee}
        base={donnees.base}
        reglages={donnees.reglages}
        tetes={tetes}
        canWrite={canWrite}
        langueUi={langueUi}
        onFerme={() => setEdition(null)}
        onEnregistre={(cle, reglage) =>
          setDonnees((d) => {
            if (!d) return d;
            const reglages = { ...d.reglages };
            if (reglage) reglages[cle] = reglage;
            else delete reglages[cle];
            return { ...d, reglages };
          })
        }
        lireTetes={lireTetes}
      />
    );
  }

  const parSection = SECTIONS_SEO.map((s) => ({ section: s, pages: filtrees.filter((p) => p.section === s) })).filter(
    (g) => g.pages.length > 0,
  );
  const dateDuPlan = new Date(donnees.planLuLe).toLocaleString(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Toronto",
  });

  return (
    <main className="mx-auto max-w-6xl p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">{t("td.pageTitle")}</h1>
        <p className="text-sm text-chanv-terre/70">{t("td.intro")}</p>
        <ul className="list-disc pl-5 text-xs text-chanv-terre/60 space-y-0.5">
          <li>{t("td.noteZones")}</li>
          <li>{t("td.noteProduits")}</li>
          <li>{t("td.astuceGoogle")}</li>
        </ul>
        {!canWrite && <p className="text-xs font-semibold text-amber-700">{t("td.lectureSeule")}</p>}
      </div>

      <section className="card p-4 flex flex-wrap items-center gap-3">
        <label className="relative flex-1 min-w-56">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-chanv-terre/40" aria-hidden="true" />
          <input
            className="input w-full pl-9"
            placeholder={t("td.recherche")}
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
          />
        </label>
        <select className="input w-auto" value={section} onChange={(e) => setSection(e.target.value as SectionSeo | "toutes")}>
          <option value="toutes">{t("td.toutesSections")}</option>
          {SECTIONS_SEO.map((s) => (
            <option key={s} value={s}>
              {t(`td.section.${s}`)}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={seulementReglees} onChange={(e) => setSeulementReglees(e.target.checked)} />
          {t("td.seulementReglees")}
        </label>
      </section>

      {parSection.length === 0 && <p className="text-sm text-chanv-terre/60">{t("td.aucunePage")}</p>}

      {parSection.map(({ section: s, pages }) => {
        const ouverte = recherchant || ouvertes.has(s);
        return (
          <section key={s} className="card p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">
                {t(`td.section.${s}`)} <span className="text-sm font-normal text-chanv-terre/50">({pages.length})</span>
              </h2>
              {!recherchant && (
                <button
                  type="button"
                  className="text-sm font-semibold underline text-chanv-terre/80"
                  onClick={() =>
                    setOuvertes((avant) => {
                      const n = new Set(avant);
                      if (n.has(s)) n.delete(s);
                      else n.add(s);
                      return n;
                    })
                  }
                >
                  {ouverte ? t("td.masquerSection") : t("td.afficherSection", { n: pages.length })}
                </button>
              )}
            </div>
            {ouverte && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-chanv-terre/50">
                      <th className="py-2 pr-3 font-semibold">{t("td.colPage")}</th>
                      <th className="py-2 pr-3 font-semibold">{t("td.colFr")}</th>
                      <th className="py-2 pr-3 font-semibold">{t("td.colEn")}</th>
                      <th className="py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {pages.map((p) => (
                      <tr key={p.id} className="border-t border-chanv-fibre align-top">
                        <td className="py-3 pr-3 w-56">
                          <p className="font-semibold">{p.nom[langueUi]}</p>
                        </td>
                        {LANGUES.map((l) => (
                          <td key={l} className="py-3 pr-3 min-w-64">
                            <CelluleAdresse
                              chemin={p.adresses[l]}
                              reglage={p.adresses[l] ? donnees.reglages[cleDeChemin(p.adresses[l]!)] : undefined}
                              tete={p.adresses[l] ? tetes[p.adresses[l]!] : undefined}
                            />
                          </td>
                        ))}
                        <td className="py-3 text-right">
                          <button type="button" className="btn-secondary whitespace-nowrap" onClick={() => setEdition(p.id)}>
                            <Pencil size={14} aria-hidden="true" /> {canWrite ? t("td.modifier") : t("td.voir")}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}

      <p className="text-xs text-chanv-terre/50">{t("td.planLu", { date: dateDuPlan })}</p>
    </main>
  );
}

/** Ce qu'une adresse dit à Google : le réglage posé ici, sinon ce que la page sert. */
function CelluleAdresse({
  chemin,
  reglage,
  tete,
}: {
  chemin: string | undefined;
  reglage: ReglageAffiche | undefined;
  tete: TeteLue | "chargement" | undefined;
}) {
  const t = useT();
  if (!chemin) return <p className="text-xs italic text-chanv-terre/40">{t("td.pasDansGoogle")}</p>;
  const lue = teteLisible(tete);
  const titre = reglage?.title || lue?.title || "";
  const description = reglage?.description || lue?.description || "";
  const enAttente = !reglage?.title && !reglage?.description && (tete === undefined || tete === "chargement");
  const enErreur = tete && tete !== "chargement" && !lue ? (tete as { erreur?: string }).erreur ?? "?" : null;
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={reglage ? "badge-accent" : "badge-neutral"}>{reglage ? t("td.regle") : t("td.texteDuSite")}</span>
        <span className="font-mono text-[11px] text-chanv-terre/50 break-all">{chemin}</span>
      </div>
      {enAttente ? (
        <p className="text-xs text-chanv-terre/40">{t("td.lecture")}</p>
      ) : enErreur && !reglage ? (
        <p className="text-xs text-amber-700">{t("td.illisible", { e: enErreur })}</p>
      ) : (
        <>
          <p className={cn("font-medium leading-snug line-clamp-2", !titre && "italic text-amber-700")}>
            {titre || t("td.aucunTitre")}
            {titre.length > REPERE_TITRE && (
              <span className="ml-1 text-xs font-semibold text-amber-700">{t("td.long", { n: titre.length })}</span>
            )}
          </p>
          <p className={cn("text-xs leading-snug line-clamp-3", description ? "text-chanv-terre/70" : "italic text-amber-700")}>
            {description || t("td.aucuneDescription")}
            {description.length > REPERE_DESCRIPTION && (
              <span className="ml-1 font-semibold text-amber-700">{t("td.long", { n: description.length })}</span>
            )}
          </p>
        </>
      )}
    </div>
  );
}

function Compteur({ valeur, max }: { valeur: string; max: number }) {
  const t = useT();
  const n = valeur.trim().length;
  if (!n) return null;
  const trop = n > max;
  return (
    <span className={cn("text-xs tabular-nums", trop ? "font-semibold text-amber-700" : "text-chanv-terre/50")}>
      {t(trop ? "td.compteurTrop" : "td.compteur", { n, max })}
    </span>
  );
}

function EditeurPage({
  page,
  base,
  reglages,
  tetes,
  canWrite,
  langueUi,
  onFerme,
  onEnregistre,
  lireTetes,
}: {
  page: PageSeo;
  base: string;
  reglages: Record<string, ReglageAffiche>;
  tetes: Tetes;
  canWrite: boolean;
  langueUi: Langue;
  onFerme: () => void;
  onEnregistre: (cle: string, reglage: ReglageAffiche | null) => void;
  lireTetes: (chemins: string[], frais?: boolean) => Promise<Record<string, TeteLue>>;
}) {
  const t = useT();
  const locale = useLocale();
  const langues = LANGUES.filter((l) => page.adresses[l]);
  const [langue, setLangue] = useState<Langue>(langues[0]);

  const enregistres = useMemo(() => {
    const out = {} as Record<Langue, ReglageEcrit>;
    for (const l of langues) {
      const r = reglages[cleDeChemin(page.adresses[l]!)];
      out[l] = { title: r?.title ?? "", description: r?.description ?? "", ogImage: r?.ogImage ?? "" };
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, reglages]);
  const [brouillon, setBrouillon] = useState<Record<Langue, ReglageEcrit>>(enregistres);
  const [enregistrement, setEnregistrement] = useState(false);
  const [verif, setVerif] = useState<"" | "cours" | "ok" | "pasEncore">("");

  const memes = (a: ReglageEcrit, b: ReglageEcrit) =>
    a.title.trim() === b.title.trim() && a.description.trim() === b.description.trim() && a.ogImage.trim() === b.ogImage.trim();
  const modifiees = langues.filter((l) => !memes(brouillon[l], enregistres[l]));

  const chemin = page.adresses[langue]!;
  const reglage = reglages[cleDeChemin(chemin)];
  const lue = teteLisible(tetes[chemin]);
  const d = brouillon[langue];
  // Le texte écrit dans le site, quand on le connaît : la page en ligne le sert
  // tant qu'aucun réglage ne le recouvre.
  const titreDuSite = reglage?.title ? null : lue?.title || null;
  const descriptionDuSite = reglage?.description ? null : lue?.description || null;
  const ariane = [new URL(base).host, ...chemin.split("/").filter(Boolean)].join(" › ");
  const apercuTitre = d.title.trim() || titreDuSite || t("td.texteDuSiteApercu");
  const apercuDescription = d.description.trim() || descriptionDuSite || t("td.texteDuSiteApercu");
  const imageOk = imageValide(d.ogImage);

  const changer = (champ: keyof ReglageEcrit, valeur: string) => {
    setVerif("");
    setBrouillon((b) => ({ ...b, [langue]: { ...b[langue], [champ]: valeur } }));
  };

  const enregistrer = async () => {
    if (!modifiees.length) {
      toast(t("td.rienAChanger"));
      return;
    }
    if (modifiees.some((l) => !imageValide(brouillon[l].ogImage))) {
      toast.error(t("td.imageInvalide"));
      return;
    }
    setEnregistrement(true);
    let retire = true;
    try {
      for (const l of modifiees) {
        const cle = cleDeChemin(page.adresses[l]!);
        const r = await api<{ reglage: ReglageAffiche | null }>(`/${encodeURIComponent(cle)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(brouillon[l]),
        });
        if (r.reglage) retire = false;
        onEnregistre(cle, r.reglage);
      }
      toast.success(t(retire ? "td.retire" : "td.enregistre"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setEnregistrement(false);
    }
  };

  const verifier = async () => {
    setVerif("cours");
    const lus = await lireTetes(langues.map((l) => page.adresses[l]!), true);
    const enLigne = langues.every((l) => {
      const c = page.adresses[l]!;
      const r = reglages[cleDeChemin(c)];
      const tl = teteLisible(lus[c]);
      if (!r) return true;
      if (!tl) return false;
      return (!r.title || tl.title === r.title) && (!r.description || tl.description === r.description) && (!r.ogImage || tl.ogImage === r.ogImage);
    });
    setVerif(enLigne ? "ok" : "pasEncore");
  };

  const quand = reglage?.modifieLe
    ? new Date(reglage.modifieLe).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "America/Toronto" })
    : null;

  return (
    <main className="mx-auto max-w-4xl p-6 space-y-6">
      <button type="button" className="text-sm font-semibold underline text-chanv-terre/80" onClick={onFerme}>
        {t("td.retour")}
      </button>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{page.nom[langueUi]}</h1>
          <p className="text-sm text-chanv-terre/60">{t(`td.section.${page.section}`)}</p>
        </div>
        <a className="btn-secondary" href={`${base}${chemin}`} target="_blank" rel="noreferrer">
          <ExternalLink size={14} aria-hidden="true" /> {t("td.ouvrir")}
        </a>
      </div>

      <section className="card p-5 space-y-5">
        {langues.length > 1 && (
          <div className="flex rounded-md border border-chanv-fibre w-fit" role="group">
            {langues.map((l) => (
              <button
                key={l}
                type="button"
                aria-pressed={langue === l}
                onClick={() => setLangue(l)}
                className={cn(
                  "px-4 py-1.5 text-sm font-semibold first:rounded-l-md last:rounded-r-md",
                  langue === l ? "bg-chanv-terre text-white" : "text-chanv-terre/60 hover:text-chanv-terre",
                )}
              >
                {t(`td.langue.${l}`)}
                {modifiees.includes(l) && <span aria-hidden="true"> •</span>}
              </button>
            ))}
          </div>
        )}
        <p className="font-mono text-xs text-chanv-terre/60 break-all">
          {base}
          {chemin}
        </p>

        <div className="rounded-md border border-chanv-fibre bg-white p-4 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-chanv-terre/50">{t("td.apercuGoogle")}</p>
          <p className="pt-1 text-sm text-[#202124] break-all">{ariane}</p>
          <p className="text-lg leading-snug text-[#1a0dab] line-clamp-1">{apercuTitre}</p>
          <p className="text-sm leading-snug text-[#4d5156] line-clamp-2">{apercuDescription}</p>
          <p className="pt-2 text-xs text-chanv-terre/50">{t("td.apercuNote")}</p>
        </div>

        <label className="block space-y-1 text-sm">
          <span className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-semibold">
              {t("td.champTitre")} ({langue.toUpperCase()})
            </span>
            <Compteur valeur={d.title} max={REPERE_TITRE} />
          </span>
          <input className="input w-full" value={d.title} disabled={!canWrite} onChange={(e) => changer("title", e.target.value)} />
          <span className="block text-xs text-chanv-terre/60">
            {titreDuSite ? t("td.videGarde", { texte: titreDuSite }) : t("td.videGardeInconnu")}
          </span>
        </label>

        <label className="block space-y-1 text-sm">
          <span className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-semibold">
              {t("td.champDescription")} ({langue.toUpperCase()})
            </span>
            <Compteur valeur={d.description} max={REPERE_DESCRIPTION} />
          </span>
          <textarea
            className="input w-full min-h-24"
            value={d.description}
            disabled={!canWrite}
            onChange={(e) => changer("description", e.target.value)}
          />
          <span className="block text-xs text-chanv-terre/60">
            {descriptionDuSite ? t("td.videGarde", { texte: descriptionDuSite }) : t("td.videGardeInconnu")}
          </span>
        </label>

        <label className="block space-y-1 text-sm">
          <span className="font-semibold">
            {t("td.champImage")} ({langue.toUpperCase()})
          </span>
          <input
            className="input w-full font-mono text-xs"
            value={d.ogImage}
            disabled={!canWrite}
            placeholder="https://"
            onChange={(e) => changer("ogImage", e.target.value)}
          />
          {!imageOk && <span className="block text-xs font-semibold text-amber-700">{t("td.imageInvalide")}</span>}
          <span className="block text-xs text-chanv-terre/60">{t("td.aideImage")}</span>
          {imageOk && d.ogImage.trim() && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={d.ogImage.trim()} alt="" className="mt-2 max-h-32 rounded border border-chanv-fibre" />
          )}
        </label>

        <p className="text-xs text-chanv-terre/50">
          {quand ? t("td.modifiePar", { date: quand, qui: reglage?.modifiePar ?? "?" }) : t("td.jamaisRegle")}
        </p>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {verif && (
            <span className={cn("mr-auto text-xs", verif === "ok" ? "text-emerald-700" : "text-chanv-terre/70")}>
              {verif === "cours" ? t("td.verifEnCours") : verif === "ok" ? t("td.verifEnLigne") : t("td.verifPasEncore")}
            </span>
          )}
          {langues.some((l) => reglages[cleDeChemin(page.adresses[l]!)]) && (
            <button type="button" className="btn-secondary" disabled={verif === "cours"} onClick={() => void verifier()}>
              {t("td.verifier")}
            </button>
          )}
          <button type="button" className="btn-secondary" disabled={enregistrement} onClick={onFerme}>
            {t("td.annuler")}
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={!canWrite || enregistrement || !modifiees.length}
            onClick={() => void enregistrer()}
          >
            {t("td.enregistrer")}
          </button>
        </div>
      </section>
    </main>
  );
}
