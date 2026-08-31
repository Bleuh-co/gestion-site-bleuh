"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Role, Variety, VarietyListResponse } from "@/lib/types";

interface VarietesListClientProps {
  role: Role;
}

const PROVINCE_LABEL: Record<string, string> = { qc: "Québec", on: "Ontario" };

/** Options du filtre « emballées depuis » — bornes relatives, pas de date en dur. */
function sinceOptions(): { value: string; label: string }[] {
  const now = new Date();
  const back = (months: number) => {
    const d = new Date(now.getFullYear(), now.getMonth() - months, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  };
  return [
    { value: "", label: "Toutes" },
    { value: back(6), label: "6 derniers mois" },
    { value: back(12), label: "12 derniers mois" },
    { value: back(24), label: "24 derniers mois" },
  ];
}

export function VarietesListClient({ role }: VarietesListClientProps) {
  const canWrite = role === "gestionnaire" || role === "admin" || role === "superadmin";

  const [varieties, setVarieties] = useState<Variety[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [since, setSince] = useState("");
  const [activeOnly, setActiveOnly] = useState(false);
  const [province, setProvince] = useState("");

  const [rebuilding, setRebuilding] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const sinces = useMemo(sinceOptions, []);

  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(
    (signal?: AbortSignal) => {
      const params = new URLSearchParams();
      if (qDebounced) params.set("q", qDebounced);
      if (since) params.set("since", since);
      if (activeOnly) params.set("active", "1");

      setLoading(true);
      setError(null);
      return fetch(`/api/varietes?${params.toString()}`, { cache: "no-store", signal })
        .then(async (res) => {
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.message || data.error || `Erreur ${res.status}`);
          return data as VarietyListResponse;
        })
        .then((data) => setVarieties(data.data || []))
        .catch((e: unknown) => {
          if (e instanceof Error && e.name === "AbortError") return;
          setError(e instanceof Error ? e.message : "Impossible de charger les variétés.");
        })
        .finally(() => setLoading(false));
    },
    [qDebounced, since, activeOnly]
  );

  useEffect(() => {
    const ctrl = new AbortController();
    load(ctrl.signal);
    return () => ctrl.abort();
  }, [load]);

  async function handleRebuild() {
    setRebuilding(true);
    setNotice(null);
    setError(null);
    try {
      const res = await fetch("/api/varietes/rebuild", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || `Erreur ${res.status}`);
      setNotice(
        `Référentiel reconstruit — ${data.created ?? 0} ajoutée(s), ${data.updated ?? 0} mise(s) à jour. ` +
          `Le tri manuel est conservé.`
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec de la reconstruction.");
    } finally {
      setRebuilding(false);
    }
  }

  // Filtre province appliqué ICI et non côté API : /admin/varieties n'expose
  // pas de paramètre province, et le vocabulaire tient en ~140 lignes. Le
  // jour où il faudra filtrer côté serveur (liste beaucoup plus longue, ou
  // sélecteur contraint par la province d'un produit), c'est BleuhAPI qui
  // devra apprendre le paramètre — pas cet écran qui devra paginer.
  const shown = useMemo(
    () => (province ? varieties.filter((v) => (v.provinces || []).includes(province as "qc" | "on")) : varieties),
    [varieties, province]
  );

  const count = shown.length;

  return (
    <main className="mx-auto max-w-6xl p-6">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-2">
        <h1 className="text-2xl font-bold">Variétés</h1>
        {canWrite && (
          <div className="flex items-center gap-2 flex-wrap">
            <button className="btn-secondary" onClick={handleRebuild} disabled={rebuilding}>
              {rebuilding ? "Reconstruction…" : "Reconstruire depuis les lots"}
            </button>
            <Link href="/varietes/curation" className="btn-primary">
              Trier le référentiel
            </Link>
          </div>
        )}
      </div>

      <p className="text-sm text-chanv-terre/60 mb-6 max-w-3xl">
        Cette liste est construite à partir des lots réellement emballés. On n&apos;y crée pas de
        variété : elle reflète la production. Le tri (fusionner deux orthographes, écarter ce qui
        n&apos;est pas une variété) se fait dans l&apos;écran dédié.
      </p>

      <div className="card p-4 mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="label">Recherche</label>
          <input
            className="input"
            placeholder="Nom d'une variété…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Province</label>
          <select className="input" value={province} onChange={(e) => setProvince(e.target.value)}>
            <option value="">Les deux</option>
            <option value="qc">Québec</option>
            <option value="on">Ontario</option>
          </select>
        </div>
        <div>
          <label className="label">Emballée depuis</label>
          <select className="input" value={since} onChange={(e) => setSince(e.target.value)}>
            {sinces.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={activeOnly}
              onChange={(e) => setActiveOnly(e.target.checked)}
            />
            Seulement les variétés encore actives
          </label>
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
      ) : count === 0 ? (
        <div className="card p-8 text-center text-gray-400">Aucune variété ne correspond aux filtres.</div>
      ) : (
        <>
          <p className="text-sm text-chanv-terre/60 mb-3">
            {count} variété{count > 1 ? "s" : ""}
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((v) => (
              <div key={v.id} className="card p-4">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-semibold text-sm">{v.name}</h2>
                  {!v.isActive && <span className="badge-neutral text-[10px] whitespace-nowrap">inactive</span>}
                </div>
                <p className="text-xs text-chanv-terre/60 mt-1">
                  {v.lotCount} lot{v.lotCount > 1 ? "s" : ""}
                  {v.firstWrapDate && v.lastWrapDate ? ` · ${v.firstWrapDate} → ${v.lastWrapDate}` : ""}
                </p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {(v.provinces || []).map((p) => (
                    <span key={p} className="badge-neutral text-[10px]">
                      {PROVINCE_LABEL[p] ?? p}
                    </span>
                  ))}
                </div>
                {v.absorbs && v.absorbs.length > 0 && (
                  <p className="text-xs text-chanv-terre/40 mt-2">
                    Regroupe aussi : {v.absorbs.join(", ")}
                  </p>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
