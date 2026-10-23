"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Lock, Plus } from "lucide-react";
import { LANG_LOCALES } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { pageAjustable, type EtatPage } from "@/lib/atterrissages-pure";
import type { FicheAffichee } from "@/lib/atterrissages-store";
import type { Role } from "@/lib/types";
import { CelluleCommentaires } from "@/components/CelluleCommentaires";
import { ouvrirDiscussion, useFilActif, useMajFil } from "@/lib/fils-client";
import { ouvertureFilPage } from "@/lib/atterrissage-discussion-pure";
import { apiSite, ETAT_CLS, useLibellesPage } from "@/lib/atterrissages-client";

/**
 * PAGES D'ATTERRISSAGE DE BLEUH.CO — la liste (plan « Pages d'atterrissage et
 * infolettres », lot L10 ; maquette « Bleuh : les pages d'atterrissage »).
 * Portée de Marketing MDH : une colonne « Zone », pas de colonne « Offre ».
 */

const HUB_URL = (process.env.NEXT_PUBLIC_HUB_URL || "https://gandalf.chanv.com").replace(/\/+$/, "");

type Filtre = "toutes" | "en-ligne" | "programmees" | "preparation" | "terminees";

/** Les six états rangés dans les cinq onglets de la liste. */
function filtreDeLetat(e: EtatPage): Exclude<Filtre, "toutes"> {
  switch (e) {
    case "en-ligne":
      return "en-ligne";
    case "programmee":
      return "programmees";
    case "preparation":
    case "prete":
      return "preparation";
    case "terminee":
    case "eteinte":
      return "terminees";
  }
}

export function PagesAtterrissageClient({ role }: { role: Role }) {
  const { t, lang, etat, zone } = useLibellesPage();
  const canWrite = role === "gestionnaire" || role === "admin" || role === "superadmin";

  const [items, setItems] = useState<FicheAffichee[]>([]);
  const [chargement, setChargement] = useState(true);
  const [filtre, setFiltre] = useState<Filtre>("toutes");
  const [busyId, setBusyId] = useState<string | null>(null);
  const { filActif, marquer: marquerFilActif } = useFilActif();

  const charger = useCallback(async () => {
    try {
      const r = await apiSite<{ items: FicheAffichee[] }>("/atterrissages");
      setItems(r.items ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    void charger();
  }, [charger]);

  // Un message posté ou lu dans le volet : la cellule suit, sans recharger.
  useMajFil((filId, compte) =>
    setItems((prev) =>
      prev.map((f) => (f.commentaires.filId === filId ? { ...f, commentaires: { ...f.commentaires, compte, nouveau: false } } : f))
    )
  );

  const comptes = useMemo(() => {
    const c: Record<Filtre, number> = { toutes: items.length, "en-ligne": 0, programmees: 0, preparation: 0, terminees: 0 };
    for (const f of items) c[filtreDeLetat(f.etat)]++;
    return c;
  }, [items]);

  const visibles = filtre === "toutes" ? items : items.filter((f) => filtreDeLetat(f.etat) === filtre);

  const partieDate = (jour: string, opts: Intl.DateTimeFormatOptions): string => {
    const [a, m, j] = jour.split("-").map(Number);
    return new Intl.DateTimeFormat(LANG_LOCALES[lang] || "fr-CA", { ...opts, timeZone: "UTC" }).format(new Date(Date.UTC(a, m - 1, j, 12)));
  };

  const datesCourtes = (f: FicheAffichee): string => {
    if (!f.debut) {
      if (!f.fin) return t("pa.datesAFixer");
      const mot = t("pa.jusquau");
      return `${mot.charAt(0).toUpperCase()}${mot.slice(1)} ${partieDate(f.fin, { day: "numeric", month: "short", year: "numeric" })}`;
    }
    if (!f.fin) return `${t("pa.desLeCourt")} ${partieDate(f.debut, { day: "numeric", month: "short", year: "numeric" })}`;
    const memeMois = f.debut.slice(0, 7) === f.fin.slice(0, 7);
    const debutTxt = partieDate(f.debut, memeMois ? { day: "numeric" } : { day: "numeric", month: "short" });
    return `${debutTxt} → ${partieDate(f.fin, { day: "numeric", month: "short", year: "numeric" })}`;
  };

  const discuter = (f: FicheAffichee) => {
    ouvrirDiscussion(
      ouvertureFilPage(
        { ...f, ajustable: pageAjustable(f.etat) },
        {
          contexte: t("fil.contextePage"),
          etat: etat(f),
          dates: { libelle: t("pa.colDates"), valeur: datesCourtes(f) },
          zone: { libelle: t("pa.colZone"), valeur: zone(f.zones) },
          visibilite: { libelle: t("pa.colVisibilite"), valeur: f.visibilite === "privee" ? t("pa.privee") : t("pa.publique") },
          fiche: t("fil.ouvrirFiche"),
          preprod: { libelle: t("pa.voirPreprod"), url: f.urls.preprod },
        }
      ),
      f.commentaires.filId
    );
    marquerFilActif(f.commentaires.filId);
    // Le volet marque la discussion comme lue : la pastille s'éteint tout de suite.
    setItems((prev) => prev.map((x) => (x.id === f.id ? { ...x, commentaires: { ...x.commentaires, nouveau: false } } : x)));
  };

  const basculer = async (f: FicheAffichee) => {
    if (!f.livree) return;
    setBusyId(f.id);
    try {
      await apiSite(`/atterrissages/${f.id}`, { method: "PATCH", body: JSON.stringify({ active: !f.active }) });
      await charger();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  };

  /** L'adresse montrée sous le nom : en anglais pour une page Canada seulement, la langue où on la visite. */
  const adresseAffichee = (f: FicheAffichee): string =>
    !f.zones.includes("qc") && f.adresse.en ? `bleuh.co/en/${f.adresse.en}/` : `bleuh.co/fr/${f.adresse.fr}/`;

  const FILTRES: { id: Filtre; label: string }[] = [
    { id: "toutes", label: t("pa.filtreToutes") },
    { id: "en-ligne", label: t("pa.filtreEnLigne") },
    { id: "programmees", label: t("pa.filtreProgrammees") },
    { id: "preparation", label: t("pa.filtrePreparation") },
    { id: "terminees", label: t("pa.filtreTerminees") },
  ];

  return (
    <main className="mx-auto max-w-6xl p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold mb-2">{t("pa.pageTitle")}</h1>
          <p className="text-sm text-chanv-terre/60 max-w-2xl">{t("pa.pageIntro")}</p>
        </div>
        {canWrite && (
          <Link href="/pages-atterrissage/demande" className="btn-primary inline-flex items-center gap-1.5">
            <Plus size={16} aria-hidden="true" />
            {t("pa.demander")}
          </Link>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTRES.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFiltre(f.id)}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
              filtre === f.id ? "bg-chanv-terre text-white" : "bg-chanv-fibre/70 text-chanv-terre/70 hover:bg-chanv-fibre"
            )}
          >
            {f.label} {comptes[f.id]}
          </button>
        ))}
      </div>

      <section className="card overflow-hidden">
        {chargement ? (
          <p className="p-5 text-sm text-chanv-terre/50">…</p>
        ) : visibles.length === 0 ? (
          <p className="p-5 text-sm text-chanv-terre/50">{t("pa.aucune")}</p>
        ) : (
          <div className="overflow-x-auto">
            {/* `table-fixed` + largeurs en px : huit colonnes dans une carte d'environ 940 px se chevauchent sinon. */}
            <table className="w-full table-fixed text-xs">
              <colgroup>
                <col style={{ width: 150 }} />
                <col style={{ width: 150 }} />
                <col style={{ width: 100 }} />
                <col style={{ width: 90 }} />
                <col style={{ width: 95 }} />
                <col style={{ width: 110 }} />
                <col style={{ width: 95 }} />
                <col style={{ width: 80 }} />
              </colgroup>
              <thead>
                <tr className="text-left text-chanv-terre/60 border-b border-chanv-fibre">
                  <th className="py-2 px-4">{t("pa.colPage")}</th>
                  <th className="py-2 px-3">{t("pa.colEtat")}</th>
                  <th className="py-2 px-3">{t("pa.colDates")}</th>
                  <th className="py-2 px-3">{t("pa.colZone")}</th>
                  <th className="py-2 px-3">{t("pa.colVisibilite")}</th>
                  <th className="py-2 px-3">{t("pa.colDemande")}</th>
                  <th className="py-2 px-2">{t("pa.colCommentaires")}</th>
                  <th className="py-2 px-3 text-center">{t("pa.colActivee")}</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((f) => (
                  <tr
                    key={f.id}
                    className={cn(
                      "border-t border-chanv-fibre/60 align-top hover:bg-chanv-fibre/20",
                      !!f.commentaires.filId && filActif === f.commentaires.filId && "bg-amber-50"
                    )}
                  >
                    <td className="py-3 px-4">
                      <Link href={`/pages-atterrissage/${f.id}`} className="font-medium hover:underline">
                        {f.nom}
                      </Link>
                      {/* `anywhere` : une adresse est un seul long mot, qui débordait sur « État ». */}
                      <div className="text-chanv-terre/50 [overflow-wrap:anywhere]">
                        {adresseAffichee(f)}
                        {!f.livree && <span> · {t("pa.adresseProposee")}</span>}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span className={cn("inline-block rounded px-2 py-0.5 font-medium", ETAT_CLS[f.etat])}>{etat(f)}</span>
                    </td>
                    <td className="py-3 px-3 text-chanv-terre/70">{datesCourtes(f)}</td>
                    <td className="py-3 px-3">{zone(f.zones)}</td>
                    <td className="py-3 px-3">
                      {f.visibilite === "privee" ? (
                        <span className="inline-flex items-start gap-1 text-chanv-terre/70">
                          <Lock size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
                          {t("pa.privee")}
                        </span>
                      ) : (
                        t("pa.publique")
                      )}
                    </td>
                    <td className="py-3 px-3">
                      {f.demande?.tache ? (
                        <a
                          href={`${HUB_URL}/?view=tasks&task=${encodeURIComponent(f.demande.tache)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium hover:underline"
                          style={{ color: "var(--app-gold)" }}
                        >
                          {t("pa.tache")}
                        </a>
                      ) : f.demande?.ticket ? (
                        <span className="inline-flex items-start gap-1.5">
                          <span
                            className={cn(
                              "mt-1 h-1.5 w-1.5 shrink-0 rounded-full",
                              f.demandeInfo?.statut === "RESOLVED" ? "bg-emerald-500" : "bg-amber-500"
                            )}
                            aria-hidden="true"
                          />
                          <span>
                            {t("pa.signalement")} ·{" "}
                            {f.demandeInfo?.statut === "RESOLVED"
                              ? t("pa.statutRegle")
                              : f.demandeInfo?.statut === "IN_PROGRESS"
                                ? t("pa.statutEnCours")
                                : t("pa.statutOuvert")}
                          </span>
                        </span>
                      ) : f.peutRenvoyer ? (
                        <Link href={`/pages-atterrissage/${f.id}`} className="font-medium text-rose-700 hover:underline">
                          {t("pa.demandeNonArrivee")}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2 px-2">
                      <CelluleCommentaires etat={f.commentaires} onOuvrir={() => discuter(f)} />
                    </td>
                    <td className="py-3 px-3 text-center">
                      {/* Case centrée sous l'en-tête « Activée » (ticket mXzqZkaj8D8LrMgoYsFQ). */}
                      <label className="flex flex-col items-center gap-0.5">
                        <input
                          type="checkbox"
                          checked={f.active}
                          disabled={!canWrite || !f.livree || busyId === f.id}
                          onChange={() => void basculer(f)}
                        />
                        {!f.livree && <span className="text-[11px] text-chanv-terre/45">{t("pa.allumeQuandLivree")}</span>}
                      </label>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="text-xs text-chanv-terre/50">{t("pa.notePiedListe")}</p>
    </main>
  );
}
