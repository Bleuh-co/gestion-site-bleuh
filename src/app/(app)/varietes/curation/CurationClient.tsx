"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Variety, VarietyExclusionKind, VarietyListResponse, VarietySummary } from "@/lib/types";
import { VarietyTargetPicker } from "../VarietyTargetPicker";

type Filter = "todo" | "merged" | "excluded" | "all";

const FILTER_LABELS: Record<Filter, string> = {
  todo: "À trier",
  merged: "Regroupées",
  excluded: "Écartées",
  all: "Toutes",
};

const EXCLUSION_LABELS: Record<VarietyExclusionKind, string> = {
  product: "Un produit, pas une variété",
  junk: "Valeur sans signification",
  other: "Autre (préciser en note)",
};

function deaccent(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export function CurationClient() {
  const [rows, setRows] = useState<Variety[]>([]);
  const [summary, setSummary] = useState<VarietySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [filter, setFilter] = useState<Filter>("todo");
  const [q, setQ] = useState("");

  /** Ligne dont une action est en cours — bloque ses boutons, pas ceux des autres. */
  const [busyId, setBusyId] = useState<number | null>(null);
  /** Ligne dont le panneau « regrouper » est ouvert, et cible choisie. */
  const [mergeOpen, setMergeOpen] = useState<number | null>(null);
  const [mergeTarget, setMergeTarget] = useState<number | "">("");

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/varietes?curation=1", { cache: "no-store", signal });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || data.error || `Erreur ${res.status}`);
      const payload = data as VarietyListResponse;
      setRows(payload.data || []);
      setSummary(payload.summary || null);
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      setError(e instanceof Error ? e.message : "Impossible de charger le référentiel.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    load(ctrl.signal);
    return () => ctrl.abort();
  }, [load]);

  /**
   * Envoie un PATCH puis RECHARGE tout.
   *
   * Pas de mise à jour optimiste : une fusion change le nombre de lots et les
   * dates de la ligne cible (roll-up fait par BleuhAPI), et le résumé en
   * haut d'écran. Recalculer ça côté navigateur, ce serait réimplémenter le
   * serveur — et se tromper le jour où l'un des deux change.
   */
  async function patch(id: number, body: Record<string, unknown>, success: string) {
    setBusyId(id);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/varietes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || `Erreur ${res.status}`);
      setNotice(success);
      setMergeOpen(null);
      setMergeTarget("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "L'opération a échoué.");
    } finally {
      setBusyId(null);
    }
  }

  const isMerged = (v: Variety) => v.mergedIntoId != null;
  const isExcluded = (v: Variety) => v.excludedAs != null;

  /** Cibles proposables : le vocabulaire courant, moins la ligne elle-même. */
  const canonicalRows = useMemo(
    () => rows.filter((v) => !isMerged(v) && !isExcluded(v)),
    [rows]
  );

  const visible = useMemo(() => {
    const needle = deaccent(q.trim());
    return rows.filter((v) => {
      if (filter === "todo" && (isMerged(v) || isExcluded(v))) return false;
      if (filter === "merged" && !isMerged(v)) return false;
      if (filter === "excluded" && !isExcluded(v)) return false;
      if (!needle) return true;
      const hay = deaccent(`${v.name} ${v.key} ${(v.absorbs || []).join(" ")} ${v.mergedIntoName || ""}`);
      return hay.includes(needle);
    });
  }, [rows, filter, q]);

  return (
    <main className="mx-auto max-w-5xl p-6">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-2">
        <h1 className="text-2xl font-bold">Trier le référentiel</h1>
        <Link href="/varietes" className="btn-secondary">
          Retour à la liste
        </Link>
      </div>

      <p className="text-sm text-chanv-terre/60 mb-6 max-w-3xl">
        L&apos;ERP mélange dans la même colonne les variétés, des noms de produits et quelques
        valeurs saisies de travers. Deux gestes ici : regrouper deux écritures d&apos;une même
        variété, ou écarter ce qui n&apos;en est pas une. Rien n&apos;est supprimé, et une
        reconstruction depuis les lots ne défait pas ce tri.
      </p>

      {summary && (
        <div className="card p-4 mb-6 grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
          <div>
            <div className="text-xl font-bold">{summary.vocabulary}</div>
            <div className="text-xs text-chanv-terre/60">proposables</div>
          </div>
          <div>
            <div className="text-xl font-bold">{summary.uncurated}</div>
            <div className="text-xs text-chanv-terre/60">jamais revues</div>
          </div>
          <div>
            <div className="text-xl font-bold">{summary.merged}</div>
            <div className="text-xs text-chanv-terre/60">regroupées</div>
          </div>
          <div>
            <div className="text-xl font-bold">{summary.excluded}</div>
            <div className="text-xs text-chanv-terre/60">écartées</div>
          </div>
          <div>
            <div className="text-xl font-bold">{summary.total}</div>
            <div className="text-xs text-chanv-terre/60">lignes brutes</div>
          </div>
        </div>
      )}

      <div className="card p-4 mb-6 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Afficher</label>
          <select className="input" value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
            {(Object.keys(FILTER_LABELS) as Filter[]).map((f) => (
              <option key={f} value={f}>
                {FILTER_LABELS[f]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Recherche</label>
          <input
            className="input"
            placeholder="Nom d'une variété…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      {notice && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 mb-4">
          {notice}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <div className="card p-8 text-center text-gray-400">Chargement…</div>
      ) : visible.length === 0 ? (
        <div className="card p-8 text-center text-gray-400">
          {filter === "todo" ? "Tout est trié." : "Aucune ligne dans cette vue."}
        </div>
      ) : (
        <>
          <p className="text-sm text-chanv-terre/60 mb-3">
            {visible.length} ligne{visible.length > 1 ? "s" : ""}
          </p>
          <div className="grid gap-3">
            {visible.map((v) => {
              const busy = busyId === v.id;
              const merged = isMerged(v);
              const excluded = isExcluded(v);
              return (
                <div key={v.id} className="card p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <h2 className="font-semibold">{v.name}</h2>
                      <p className="text-xs text-chanv-terre/60 mt-1">
                        {v.lotCount} lot{v.lotCount > 1 ? "s" : ""}
                        {v.firstWrapDate && v.lastWrapDate
                          ? ` · ${v.firstWrapDate} → ${v.lastWrapDate}`
                          : ""}
                      </p>
                      {v.absorbs && v.absorbs.length > 0 && (
                        <p className="text-xs text-chanv-terre/40 mt-1">
                          Regroupe : {v.absorbs.join(", ")}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {merged && (
                        <span className="badge-accent text-[10px] whitespace-nowrap">
                          → {v.mergedIntoName}
                        </span>
                      )}
                      {excluded && (
                        <span className="badge-neutral text-[10px] whitespace-nowrap">
                          {EXCLUSION_LABELS[v.excludedAs as VarietyExclusionKind]}
                        </span>
                      )}
                    </div>
                  </div>

                  {v.curationNote && (
                    <p className="text-xs text-chanv-terre/50 mt-2 italic">« {v.curationNote} »</p>
                  )}

                  {/* ── Actions ─────────────────────────────────────── */}
                  {merged || excluded ? (
                    <div className="mt-3">
                      <button
                        className="btn-secondary"
                        disabled={busy}
                        onClick={() =>
                          patch(
                            v.id,
                            merged ? { mergedIntoId: null } : { excludedAs: null },
                            merged
                              ? `« ${v.name} » redevient une variété à part entière.`
                              : `« ${v.name} » réintégrée au référentiel.`
                          )
                        }
                      >
                        {busy ? "…" : merged ? "Séparer à nouveau" : "Réintégrer"}
                      </button>
                    </div>
                  ) : (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        className="btn-secondary"
                        disabled={busy}
                        onClick={() => {
                          setMergeOpen(mergeOpen === v.id ? null : v.id);
                          setMergeTarget("");
                        }}
                      >
                        {mergeOpen === v.id ? "Annuler" : "C'est la même qu'une autre"}
                      </button>

                      <select
                        className="input max-w-xs"
                        defaultValue=""
                        disabled={busy}
                        onChange={(e) => {
                          const kind = e.target.value as VarietyExclusionKind | "";
                          e.target.value = "";
                          if (!kind) return;
                          patch(
                            v.id,
                            { excludedAs: kind },
                            `« ${v.name} » ne sera plus proposée comme variété.`
                          );
                        }}
                        aria-label={`Écarter ${v.name}`}
                      >
                        <option value="">Ce n&apos;est pas une variété…</option>
                        {(Object.keys(EXCLUSION_LABELS) as VarietyExclusionKind[]).map((k) => (
                          <option key={k} value={k}>
                            {EXCLUSION_LABELS[k]}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {mergeOpen === v.id && !merged && !excluded && (
                    <div className="mt-3 border-t border-chanv-fibre pt-3">
                      <label className="label">Regrouper « {v.name} » dans :</label>
                      <VarietyTargetPicker
                        options={canonicalRows.filter((o) => o.id !== v.id)}
                        value={mergeTarget}
                        onChange={setMergeTarget}
                        disabled={busy}
                      />
                      <p className="text-xs text-chanv-terre/50 mt-2">
                        Les lots de « {v.name} » seront comptés avec ceux de la variété choisie, et
                        cette écriture ne sera plus proposée. C&apos;est réversible.
                      </p>
                      <button
                        className="btn-primary mt-2"
                        disabled={busy || mergeTarget === ""}
                        onClick={() =>
                          patch(
                            v.id,
                            { mergedIntoId: mergeTarget },
                            `« ${v.name} » regroupée avec « ${
                              canonicalRows.find((o) => o.id === mergeTarget)?.name ?? ""
                            } ».`
                          )
                        }
                      >
                        {busy ? "…" : "Regrouper"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </main>
  );
}
