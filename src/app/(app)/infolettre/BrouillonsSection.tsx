"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Trash2 } from "lucide-react";
import { CelluleCommentaires } from "@/components/CelluleCommentaires";
import { ouvrirDiscussion, useMajFil } from "@/lib/fils-client";
import {
  lienMailerLite,
  ouvertureFilCampagne,
  type CampagneNonEnvoyee,
} from "@/lib/campagnes-brouillons-pure";
import type { EtatFil } from "@/lib/fils-pure";

/**
 * Les campagnes MailerLite Bleuh pas encore parties (plan « Pages
 * d'atterrissage et infolettres », lot L12) : brouillons et envois
 * programmés, leur discussion, un lien vers MailerLite, et la corbeille sur
 * un brouillon. Les infolettres de Bleuh se composent toujours dans
 * MailerLite (décision D4 = b).
 */

type Ligne = CampagneNonEnvoyee & { commentaires: EtatFil };

export function fmtDateHeure(s?: string | null): string {
  if (!s) return "—";
  // Les dates ML arrivent "YYYY-MM-DD HH:MM:SS" (heure du compte).
  const d = new Date(s.replace(" ", "T"));
  if (isNaN(d.getTime())) return s;
  return d.toLocaleString("fr-CA", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** Ouvre la discussion d'une campagne, envoyée ou non. */
export function discuterCampagne(
  c: { id: string; name: string; subject: string },
  etat: string,
  date: { libelle: string; valeur: string },
  filId: string
) {
  ouvrirDiscussion(
    ouvertureFilCampagne(c, {
      contexte: "Infolettre Bleuh · MailerLite",
      etat,
      objet: { libelle: "Objet", valeur: c.subject },
      date,
      ouvrir: "Ouvrir l'onglet Campagnes",
    }),
    filId
  );
}

export function BrouillonsSection({ canWrite, campagneCiblee }: { canWrite: boolean; campagneCiblee?: string | null }) {
  const [lignes, setLignes] = useState<Ligne[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/infolettre/brouillons", { cache: "no-store" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || `Erreur ${res.status}`);
      setLignes(body.campagnes ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible de charger les brouillons.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useMajFil((filId, compte) =>
    setLignes((prev) =>
      prev ? prev.map((l) => (l.commentaires.filId === filId ? { ...l, commentaires: { ...l.commentaires, compte, nouveau: false } } : l)) : prev
    )
  );

  // Arrivée par une mention : la campagne visée est mise en évidence.
  useEffect(() => {
    if (!campagneCiblee || !lignes) return;
    document.getElementById(`campagne-${campagneCiblee}`)?.scrollIntoView({ block: "center" });
  }, [campagneCiblee, lignes]);

  const supprimer = async (l: Ligne) => {
    if (!window.confirm(`Supprimer le brouillon « ${l.name || l.subject} » dans MailerLite ? Cette action est irréversible.`)) return;
    setEnCours(l.id);
    setError(null);
    try {
      const res = await fetch(`/api/infolettre/brouillons/${encodeURIComponent(l.id)}`, { method: "DELETE" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || `Erreur ${res.status}`);
      setLignes((prev) => (prev ? prev.filter((x) => x.id !== l.id) : prev));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Suppression impossible.");
      load();
    } finally {
      setEnCours(null);
    }
  };

  return (
    <section className="mb-8">
      <div className="flex items-baseline justify-between flex-wrap gap-2 mb-2">
        <h2 className="text-lg font-bold">Pas encore envoyées</h2>
        <p className="text-xs text-chanv-terre/50">
          Brouillons et envois programmés de MailerLite. On les compose dans MailerLite ; ici, on en discute.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 mb-3">{error}</div>
      )}

      <div className="card table-scroll">
        <table className="w-full table-fixed text-sm">
          <colgroup>
            <col />
            <col style={{ width: 170 }} />
            <col style={{ width: 120 }} />
            <col style={{ width: 110 }} />
            <col style={{ width: 96 }} />
          </colgroup>
          <thead>
            <tr className="text-left text-chanv-terre/60 border-b border-black/5">
              <th className="px-4 py-3 font-semibold">Nom / Sujet</th>
              <th className="px-3 py-3 font-semibold">État</th>
              <th className="px-3 py-3 font-semibold whitespace-nowrap">Créée le</th>
              <th className="px-2 py-3 font-semibold">Commentaires</th>
              <th className="px-3 py-3" aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {lignes === null ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-400">Chargement…</td>
              </tr>
            ) : lignes.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-400">Aucun brouillon ni envoi programmé.</td>
              </tr>
            ) : (
              lignes.map((l) => {
                const programmee = l.statut === "programmee";
                return (
                  <tr
                    key={l.id}
                    id={`campagne-${l.id}`}
                    className={`border-b border-black/5 last:border-0 align-top ${campagneCiblee === l.id ? "bg-amber-50" : ""}`}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium [overflow-wrap:anywhere]">{l.name || "—"}</div>
                      <div className="text-xs text-chanv-terre/50 [overflow-wrap:anywhere]">{l.subject}</div>
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          programmee ? "bg-sky-100 text-sky-800" : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {programmee ? "Programmée" : "Brouillon"}
                      </span>
                      {programmee && (
                        <div className="mt-1 text-xs text-chanv-terre/60 whitespace-nowrap">{fmtDateHeure(l.dateSend)}</div>
                      )}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-chanv-terre/60">{fmtDateHeure(l.dateCreated)}</td>
                    <td className="px-2 py-3">
                      <CelluleCommentaires
                        etat={l.commentaires}
                        onOuvrir={() =>
                          discuterCampagne(
                            l,
                            programmee ? "Programmée" : "Brouillon",
                            programmee
                              ? { libelle: "Envoi prévu", valeur: fmtDateHeure(l.dateSend) }
                              : { libelle: "Créée le", valeur: fmtDateHeure(l.dateCreated) },
                            l.commentaires.filId
                          )
                        }
                      />
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                        <a
                          href={lienMailerLite(l.statut)}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={programmee ? "Ouvrir les envois programmés dans MailerLite" : "Ouvrir les brouillons dans MailerLite"}
                          aria-label="Ouvrir dans MailerLite"
                          className="inline-flex h-8 w-8 items-center justify-center rounded hover:bg-chanv-fibre/60 text-chanv-terre/70"
                        >
                          <ExternalLink size={15} aria-hidden="true" />
                        </a>
                        {canWrite && !programmee && (
                          <button
                            type="button"
                            onClick={() => supprimer(l)}
                            disabled={enCours === l.id}
                            title="Supprimer ce brouillon"
                            aria-label="Supprimer ce brouillon"
                            className="inline-flex h-8 w-8 items-center justify-center rounded text-rose-600 hover:bg-rose-50 disabled:opacity-40"
                          >
                            <Trash2 size={15} aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
