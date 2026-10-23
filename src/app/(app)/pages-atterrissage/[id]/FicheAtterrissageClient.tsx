"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ExternalLink, MessageSquare, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { dateLongue, pageAjustable, phrasesDeLaPage, type ApresFin, type Visibilite, type Zone } from "@/lib/atterrissages-pure";
import type { FicheAffichee } from "@/lib/atterrissages-store";
import type { Role } from "@/lib/types";
import { ouvrirDiscussion, useMajFil } from "@/lib/fils-client";
import { ouvertureFilPage } from "@/lib/atterrissage-discussion-pure";
import { apiSite, ETAT_CLS, useLibellesPage } from "@/lib/atterrissages-client";

/**
 * LA FICHE D'UNE PAGE D'ATTERRISSAGE DE BLEUH.CO (lot L10 ; maquette « La
 * fiche de Bleuh Original Québec ») : les réglages de Maison d'Herbes, plus la
 * zone. Les produits s'affichent avec leur point de vente, jamais un prix.
 * La demande d'origine appartient à Support Web : lecture seule.
 */

const HUB_URL = (process.env.NEXT_PUBLIC_HUB_URL || "https://gandalf.chanv.com").replace(/\/+$/, "");

type ChoixZone = "qc" | "ca" | "qcca";
const ZONES_DU_CHOIX: Record<ChoixZone, Zone[]> = { qc: ["qc"], ca: ["ca"], qcca: ["qc", "ca"] };
const choixDesZones = (z: readonly Zone[]): ChoixZone => (z.includes("qc") && z.includes("ca") ? "qcca" : z.includes("qc") ? "qc" : "ca");

interface FormeFiche {
  active: boolean;
  debut: string;
  fin: string;
  sansFin: boolean;
  apercu: string;
  zone: ChoixZone;
  visibilite: Visibilite;
  apres: ApresFin;
  renvoi: string;
}

function formeDeLaFiche(f: FicheAffichee): FormeFiche {
  return {
    active: f.active,
    debut: f.debut ?? "",
    fin: f.fin ?? "",
    sansFin: !!f.debut && !f.fin,
    apercu: f.apercu ?? "",
    zone: choixDesZones(f.zones),
    visibilite: f.visibilite,
    apres: f.apres,
    renvoi: f.renvoi ?? "",
  };
}

export function FicheAtterrissageClient({ id, role }: { id: string; role: Role }) {
  const { t, locale, etat, zone } = useLibellesPage();
  const canWrite = role === "gestionnaire" || role === "admin" || role === "superadmin";

  const [fiche, setFiche] = useState<FicheAffichee | null>(null);
  const [chargement, setChargement] = useState(true);
  const [forme, setForme] = useState<FormeFiche | null>(null);
  const [busy, setBusy] = useState(false);
  const [renvoi, setRenvoi] = useState(false);

  const charger = useCallback(async () => {
    try {
      const f = await apiSite<FicheAffichee>(`/atterrissages/${encodeURIComponent(id)}`);
      setFiche(f);
      setForme(formeDeLaFiche(f));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setChargement(false);
    }
  }, [id]);

  useEffect(() => {
    void charger();
  }, [charger]);

  // Un message posté ou lu dans le volet : le compteur suit, sans recharger.
  useMajFil((filId, compte) =>
    setFiche((f) => (f && f.commentaires.filId === filId ? { ...f, commentaires: { ...f.commentaires, compte, nouveau: false } } : f))
  );

  const renvoyerDemande = async () => {
    setRenvoi(true);
    try {
      const r = await apiSite<{ signalement?: { ok?: boolean; error?: string } }>(
        `/atterrissages/${encodeURIComponent(id)}/renvoyer-demande`,
        { method: "POST" }
      );
      if (r.signalement?.ok) toast.success(t("pa.demandeRenvoyee"));
      else toast.error(r.signalement?.error || t("pa.demandeToujoursPasArrivee"));
      await charger();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setRenvoi(false);
    }
  };

  const diff = useMemo(() => {
    if (!fiche || !forme) return {};
    const out: Record<string, unknown> = {};
    if (forme.active !== fiche.active) out.active = forme.active;
    if ((forme.debut || null) !== fiche.debut) out.debut = forme.debut || null;
    const finVoulue = forme.sansFin ? null : forme.fin || null;
    if (finVoulue !== fiche.fin) out.fin = finVoulue;
    if ((forme.apercu || null) !== fiche.apercu) out.apercu = forme.apercu || null;
    if (forme.zone !== choixDesZones(fiche.zones)) out.zones = ZONES_DU_CHOIX[forme.zone];
    if (forme.visibilite !== fiche.visibilite) out.visibilite = forme.visibilite;
    if (forme.apres !== fiche.apres) out.apres = forme.apres;
    if (forme.apres === "renvoi" && (forme.renvoi || null) !== fiche.renvoi) out.renvoi = forme.renvoi || null;
    return out;
  }, [fiche, forme]);

  const aDesChangements = Object.keys(diff).length > 0;

  const enregistrer = async () => {
    if (!aDesChangements) return;
    setBusy(true);
    try {
      await apiSite(`/atterrissages/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(diff) });
      toast.success(t("pa.enregistre"));
      await charger();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (chargement || !fiche || !forme) {
    return (
      <main className="mx-auto max-w-6xl p-6">
        <p className="text-sm text-chanv-terre/50">…</p>
      </main>
    );
  }

  const libelleEtat = etat(fiche);
  const finPrevue = forme.sansFin ? null : forme.fin || null;
  const apercuFr = forme.debut ? phrasesDeLaPage({ debut: forme.debut, fin: finPrevue }, "fr") : null;
  const apercuEn = forme.debut ? phrasesDeLaPage({ debut: forme.debut, fin: finPrevue }, "en") : null;
  const adresseVue = fiche.urls.site.replace(/^https:\/\//, "");

  const discuter = () => {
    const jour = (j: string | null) => (j ? dateLongue(j, locale) : "");
    ouvrirDiscussion(
      ouvertureFilPage(
        { ...fiche, ajustable: pageAjustable(fiche.etat) },
        {
          contexte: t("fil.contextePage"),
          etat: libelleEtat,
          dates: { libelle: t("pa.colDates"), valeur: [jour(fiche.debut), jour(fiche.fin)].filter(Boolean).join(" → ") },
          zone: { libelle: t("pa.colZone"), valeur: zone(fiche.zones) },
          visibilite: { libelle: t("pa.colVisibilite"), valeur: fiche.visibilite === "privee" ? t("pa.privee") : t("pa.publique") },
          fiche: t("fil.ouvrirFiche"),
        }
      ),
      fiche.commentaires.filId
    );
    setFiche({ ...fiche, commentaires: { ...fiche.commentaires, nouveau: false } });
  };

  const radio = <K extends keyof FormeFiche>(champ: K, valeur: FormeFiche[K], libelle: string, nom: string) => (
    <label className="flex items-center gap-2 text-sm">
      <input type="radio" name={nom} checked={forme[champ] === valeur} disabled={!canWrite} onChange={() => setForme({ ...forme, [champ]: valeur })} />
      {libelle}
    </label>
  );

  return (
    <main className="mx-auto max-w-6xl p-6 space-y-6">
      <Link href="/pages-atterrissage" className="text-sm text-chanv-terre/60 hover:underline">
        {t("pa.retour")}
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{fiche.nom}</h1>
        <span className={cn("inline-block rounded px-2 py-0.5 text-xs font-medium whitespace-nowrap", ETAT_CLS[fiche.etat])}>{libelleEtat}</span>
      </div>
      {fiche.note && <p className="text-sm italic text-chanv-terre/50">{fiche.note}</p>}

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="text-chanv-terre/60">{adresseVue}/</span>
        <a href={fiche.urls.site} target="_blank" rel="noreferrer" className="btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs">
          {t("pa.voirLaPage")} <ExternalLink size={12} aria-hidden="true" />
        </a>
        {fiche.urls.preprod && (
          <a href={fiche.urls.preprod} target="_blank" rel="noreferrer" className="text-xs font-medium hover:underline" style={{ color: "var(--app-gold)" }}>
            {t("pa.voirPreprod")}
          </a>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <section className="card p-5 space-y-4">
            <h2 className="text-lg font-semibold">{t("pa.programmation")}</h2>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={forme.active}
                disabled={!canWrite || (!fiche.livree && !fiche.active)}
                onChange={(e) => setForme({ ...forme, active: e.target.checked })}
              />
              {t("pa.activee")}
            </label>
            <p className="text-xs text-chanv-terre/50 -mt-2">{fiche.livree ? t("pa.activeeHint") : t("pa.allumeQuandLivree")}</p>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label">{t("pa.debut")}</label>
                <input className="input" type="date" value={forme.debut} disabled={!canWrite} onChange={(e) => setForme({ ...forme, debut: e.target.value })} />
              </div>
              <div>
                <label className="label">{t("pa.fin")}</label>
                <input
                  className="input"
                  type="date"
                  value={forme.fin}
                  disabled={!canWrite || forme.sansFin}
                  onChange={(e) => setForme({ ...forme, fin: e.target.value })}
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={forme.sansFin}
                disabled={!canWrite}
                onChange={(e) => setForme({ ...forme, sansFin: e.target.checked, fin: e.target.checked ? "" : forme.fin })}
              />
              {t("pa.sansFin")}
            </label>
            <p className="text-xs text-chanv-terre/50 -mt-2">{t("pa.finHint")}</p>

            <div>
              <label className="label">{t("pa.apercu")}</label>
              <input className="input max-w-xs" type="date" value={forme.apercu} disabled={!canWrite} onChange={(e) => setForme({ ...forme, apercu: e.target.value })} />
              <p className="text-xs text-chanv-terre/50 mt-1">{t("pa.apercuHint")}</p>
            </div>
          </section>

          <section className="card p-5 space-y-3">
            <h2 className="text-lg font-semibold">{t("pa.zone")}</h2>
            {radio("zone", "qc", t("pa.zone.qc"), "zone")}
            {radio("zone", "ca", t("pa.zone.ca"), "zone")}
            {radio("zone", "qcca", t("pa.zone.qcca"), "zone")}
            <p className="text-xs text-chanv-terre/50">{t("pa.zoneHint")}</p>
            <p className="text-xs text-chanv-terre/50">
              {t("pa.langues")} : {fiche.langues.includes("en") ? t("pa.langues.frEn") : t("pa.langues.fr")}
            </p>
          </section>

          <section className="card p-5 space-y-3">
            <h2 className="text-lg font-semibold">{t("pa.ceQueLaPageAffiche")}</h2>
            <p className="text-xs text-chanv-terre/50">{t("pa.ceQueLaPageAfficheHint")}</p>
            {apercuFr && apercuEn ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-chanv-terre/60">
                      <th className="py-1 pr-3" />
                      <th className="py-1 pr-3">{t("pa.francais")}</th>
                      {fiche.langues.includes("en") && <th className="py-1">{t("pa.anglais")}</th>}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-chanv-fibre/60">
                      <td className="py-2 pr-3 font-medium">{t("pa.periode")}</td>
                      <td className="py-2 pr-3">{apercuFr.periode}</td>
                      {fiche.langues.includes("en") && <td className="py-2">{apercuEn.periode}</td>}
                    </tr>
                    {finPrevue && (
                      <tr className="border-t border-chanv-fibre/60">
                        <td className="py-2 pr-3 font-medium">{t("pa.finDeLaPage")}</td>
                        <td className="py-2 pr-3">jusqu&apos;au {apercuFr.fin}</td>
                        {fiche.langues.includes("en") && <td className="py-2">until {apercuEn.fin}</td>}
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-chanv-terre/50">{t("pa.sansDatesPasDePhrase")}</p>
            )}
          </section>

          <section className="card p-5 space-y-3">
            <h2 className="text-lg font-semibold">{t("pa.visibilite")}</h2>
            {radio("visibilite", "publique", t("pa.publiqueDesc"), "visibilite")}
            {radio("visibilite", "privee", t("pa.priveeDesc"), "visibilite")}
          </section>

          <section className="card p-5 space-y-3">
            <h2 className="text-lg font-semibold">{t("pa.apresLaFin")}</h2>
            {radio("apres", "terminee", t("pa.apresTerminee"), "apres")}
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="apres" checked={forme.apres === "renvoi"} disabled={!canWrite} onChange={() => setForme({ ...forme, apres: "renvoi" })} />
              {t("pa.apresRenvoi")}
              <input
                className="input ml-2 max-w-xs"
                placeholder="/"
                value={forme.renvoi}
                disabled={!canWrite || forme.apres !== "renvoi"}
                onChange={(e) => setForme({ ...forme, renvoi: e.target.value })}
              />
            </label>
            {radio("apres", "retiree", t("pa.apresRetiree"), "apres")}
          </section>

          {canWrite && (
            <div className="flex items-center gap-2">
              <button type="button" className="btn-primary" disabled={busy || !aDesChangements} onClick={() => void enregistrer()}>
                {t("pa.enregistrer")}
              </button>
              <button type="button" className="btn-secondary" disabled={busy || !aDesChangements} onClick={() => setForme(formeDeLaFiche(fiche))}>
                {t("pa.annuler")}
              </button>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <section className="card p-5 space-y-3">
            <h2 className="text-base font-semibold">{t("pa.produits")}</h2>
            {fiche.produitsResolus.length === 0 ? (
              <p className="text-sm text-chanv-terre/50">{t("pa.aucunProduit")}</p>
            ) : (
              fiche.produitsResolus.map((p) => (
                <div key={p.id} className="flex items-center gap-3">
                  {p.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image} alt="" className="h-12 w-12 shrink-0 rounded object-cover" />
                  ) : (
                    <span className="h-12 w-12 shrink-0 rounded bg-chanv-fibre" aria-hidden="true" />
                  )}
                  <div>
                    <p className="text-sm font-medium">{(locale === "en" && p.nom.en) || p.nom.fr || p.id}</p>
                    <p className="text-xs text-chanv-terre/50">
                      {p.pointsDeVente.length ? t("pa.enVenteA", { lieux: p.pointsDeVente.join(" · ") }) : t("pa.pasEnVente")}
                    </p>
                  </div>
                </div>
              ))
            )}
          </section>

          <section className="card p-5 space-y-2">
            <h2 className="text-base font-semibold">{t("pa.laDemande")}</h2>
            {fiche.demande?.tache ? (
              <>
                <p className="text-xs uppercase tracking-wide text-chanv-terre/50">{t("pa.tacheGandalf")}</p>
                <a
                  href={`${HUB_URL}/?view=tasks&task=${encodeURIComponent(fiche.demande.tache)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-medium hover:underline"
                  style={{ color: "var(--app-gold)" }}
                >
                  {t("pa.ouvrirLaTache")}
                </a>
              </>
            ) : null}
            {fiche.demande?.ticket ? (
              <>
                <p className="text-sm">
                  {t("pa.signalement")} ·{" "}
                  {fiche.demandeInfo?.statut === "RESOLVED"
                    ? t("pa.statutRegle")
                    : fiche.demandeInfo?.statut === "IN_PROGRESS"
                      ? t("pa.statutEnCours")
                      : t("pa.statutOuvert")}
                </p>
                {fiche.demandeInfo?.assigneeEmail && (
                  <p className="text-xs text-chanv-terre/50">
                    {t("pa.priseEnChargePar")} {fiche.demandeInfo.assigneeEmail}
                  </p>
                )}
              </>
            ) : fiche.peutRenvoyer ? (
              <>
                <p className="text-sm font-medium text-rose-700">{t("pa.demandeNonArrivee")}</p>
                <p className="text-xs text-chanv-terre/50">{t("pa.demandeNonArriveeHint")}</p>
                {canWrite && (
                  <button
                    type="button"
                    className="btn-primary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs"
                    disabled={renvoi}
                    onClick={() => void renvoyerDemande()}
                  >
                    <Send size={12} aria-hidden="true" />
                    {t("pa.renvoyerDemande")}
                  </button>
                )}
              </>
            ) : fiche.rangeeLe ? (
              <p className="text-sm text-chanv-terre/60">{t("pa.rangeeLe", { date: dateLongue(fiche.rangeeLe.slice(0, 10), locale) })}</p>
            ) : !fiche.demande?.tache ? (
              <p className="text-sm text-chanv-terre/50">—</p>
            ) : null}
            {fiche.demande?.par && (
              <p className="text-xs text-chanv-terre/50">
                {fiche.demande.par}
                {fiche.demande.le ? ` · ${fiche.demande.le.slice(0, 10)}` : ""}
              </p>
            )}
          </section>

          <section className="card p-5 space-y-3">
            <h2 className="text-base font-semibold">{t("pa.discussionCarte")}</h2>
            {fiche.commentaires.filId ? (
              <>
                <button type="button" onClick={discuter} className="btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-sm">
                  <MessageSquare size={15} aria-hidden="true" />
                  {t("fil.ouvrir")}
                  {fiche.commentaires.nouveau && (
                    <span className="rounded-full bg-rose-100 px-1.5 text-[10px] font-semibold text-rose-700">{t("fil.nouveau")}</span>
                  )}
                </button>
                <p className="text-sm text-chanv-terre/50">
                  {fiche.commentaires.compte ? t("pa.nCommentaires", { n: fiche.commentaires.compte }) : t("pa.aucunCommentaire")}
                </p>
              </>
            ) : (
              <p className="text-sm text-chanv-terre/50">—</p>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
