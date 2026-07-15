"use client";

import { useEffect, useState } from "react";
import {
  flattenOverrides,
  fmtDate,
  outilsFetch,
  resultMessage,
  type OverrideRow,
  type ResultBanner,
} from "./outils-types";
import { OutilsResultBanner } from "./OutilsResultBanner";

interface OverrideItemDraft {
  lot: string;
  qty: string;
}

const EMPTY_ITEM: OverrideItemDraft = { lot: "", qty: "" };

interface OutilsOverridesCardProps {
  canWrite: boolean;
}

/** Section 4 — Overrides de lots (GET/POST/DELETE /api/outils/lot-overrides). */
export function OutilsOverridesCard({ canWrite }: OutilsOverridesCardProps) {
  const [rows, setRows] = useState<OverrideRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [listResult, setListResult] = useState<ResultBanner>(null);
  const [deleteBusyIndex, setDeleteBusyIndex] = useState<number | null>(null);

  const [store, setStore] = useState("");
  const [gtin, setGtin] = useState("");
  const [liveQty, setLiveQty] = useState("");
  const [threshold, setThreshold] = useState("");
  const [items, setItems] = useState<OverrideItemDraft[]>([{ ...EMPTY_ITEM }]);
  const [createBusy, setCreateBusy] = useState(false);
  const [createResult, setCreateResult] = useState<ResultBanner>(null);

  const loadOverrides = async () => {
    setLoading(true);
    setListResult(null);
    try {
      const data = await outilsFetch("/lot-overrides");
      setRows(flattenOverrides(data));
    } catch (e) {
      setRows([]);
      setListResult({ ok: false, message: e instanceof Error ? e.message : "Erreur." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOverrides();
  }, []);

  const handleDelete = async (row: OverrideRow, index: number) => {
    if (
      !window.confirm(`Supprimer l'override du lot « ${row.lot ?? "?"} » (magasin ${row.store ?? "?"}) ?`)
    ) {
      return;
    }
    setDeleteBusyIndex(index);
    setListResult(null);
    try {
      const data = await outilsFetch("/lot-overrides", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ store_number: row.store, GTIN: row.gtin, lot: row.lot }),
      });
      setListResult({ ok: true, message: `Supprimé — ${resultMessage(data)}` });
      await loadOverrides();
    } catch (e) {
      setListResult({ ok: false, message: e instanceof Error ? e.message : "Erreur." });
    } finally {
      setDeleteBusyIndex(null);
    }
  };

  const addItem = () => setItems((prev) => [...prev, { ...EMPTY_ITEM }]);
  const removeItem = (index: number) => setItems((prev) => prev.filter((_, i) => i !== index));
  const updateItem = (index: number, patch: Partial<OverrideItemDraft>) =>
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));

  const resetForm = () => {
    setStore("");
    setGtin("");
    setLiveQty("");
    setThreshold("");
    setItems([{ ...EMPTY_ITEM }]);
  };

  const handleCreate = async () => {
    const cleanItems = items
      .map((it) => ({ lot: it.lot.trim(), qty: Number(it.qty || 0) }))
      .filter((it) => it.lot);
    if (!store.trim() || !gtin.trim() || cleanItems.length === 0) {
      setCreateResult({ ok: false, message: "Magasin, GTIN et au moins un lot sont requis." });
      return;
    }
    const payload: Record<string, unknown> = { store_number: store.trim(), GTIN: gtin.trim(), items: cleanItems };
    if (liveQty !== "") payload.live_qty = Number(liveQty);
    if (threshold !== "") payload.override_until_qty_sold = Number(threshold);

    setCreateBusy(true);
    setCreateResult(null);
    try {
      const data = await outilsFetch("/lot-overrides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setCreateResult({ ok: true, message: `Créé — ${resultMessage(data)}` });
      resetForm();
      await loadOverrides();
    } catch (e) {
      setCreateResult({ ok: false, message: e instanceof Error ? e.message : "Erreur." });
    } finally {
      setCreateBusy(false);
    }
  };

  return (
    <section className="card p-4 space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Overrides de lots</h2>
        <p className="text-sm text-chanv-terre/70">
          Force la mise en avant de lots précis pour un magasin (contourne la rotation automatique).
        </p>
      </div>

      <OutilsResultBanner result={listResult} />

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-chanv-fibre">
              <th className="px-4 py-2">Magasin</th>
              <th className="px-4 py-2">GTIN</th>
              <th className="px-4 py-2">Lot</th>
              <th className="px-4 py-2">Qté</th>
              <th className="px-4 py-2">Restant</th>
              <th className="px-4 py-2">Ordre</th>
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2">Statut</th>
              {canWrite && <th className="px-4 py-2" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-chanv-fibre">
            {loading ? (
              <tr>
                <td colSpan={canWrite ? 9 : 8} className="px-4 py-6 text-center text-chanv-terre/50">
                  Chargement…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={canWrite ? 9 : 8} className="px-4 py-6 text-center text-chanv-terre/50">
                  Aucun override actif.
                </td>
              </tr>
            ) : (
              rows.map((r, i) => (
                <tr key={i} className={r.expired ? "opacity-50" : ""}>
                  <td className="px-4 py-2">{r.store ?? "—"}</td>
                  <td className="px-4 py-2">{r.gtin ?? "—"}</td>
                  <td className="px-4 py-2">
                    {r.lot ?? "—"}
                    {r.variety && <span className="text-chanv-terre/50"> ({r.variety})</span>}
                  </td>
                  <td className="px-4 py-2">{r.liveQty ?? r.qty ?? "—"}</td>
                  <td className="px-4 py-2">{r.remaining ?? "—"}</td>
                  <td className="px-4 py-2">{r.order ?? "—"}</td>
                  <td className="px-4 py-2">{r.date ? fmtDate(r.date) : "—"}</td>
                  <td className="px-4 py-2">
                    <span className={r.expired ? "badge-neutral" : "badge-accent"}>
                      {r.expired ? "Expiré" : "Actif"}
                    </span>
                  </td>
                  {canWrite && (
                    <td className="px-4 py-2 text-right">
                      <button
                        type="button"
                        className="btn-secondary text-rose-600"
                        disabled={deleteBusyIndex !== null}
                        onClick={() => void handleDelete(r, i)}
                      >
                        {deleteBusyIndex === i ? "Suppression…" : "Supprimer"}
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {canWrite && (
        <div className="border-t border-chanv-fibre pt-4 space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-chanv-terre/70">Ajouter un override</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="label">Magasin</label>
              <input className="input" value={store} onChange={(e) => setStore(e.target.value)} />
            </div>
            <div>
              <label className="label">GTIN</label>
              <input className="input" value={gtin} onChange={(e) => setGtin(e.target.value)} />
            </div>
            <div>
              <label className="label">Qté en vitrine (optionnel)</label>
              <input
                className="input"
                type="number"
                min={0}
                value={liveQty}
                onChange={(e) => setLiveQty(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Seuil de fin (optionnel)</label>
              <input
                className="input"
                type="number"
                min={0}
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="label">Lots</label>
            {items.map((it, i) => (
              <div key={i} className="flex gap-2 flex-wrap">
                <input
                  className="input flex-1 min-w-[10rem]"
                  placeholder="Nom du lot"
                  value={it.lot}
                  onChange={(e) => updateItem(i, { lot: e.target.value })}
                />
                <input
                  className="input w-32"
                  type="number"
                  min={0}
                  placeholder="Qté"
                  value={it.qty}
                  onChange={(e) => updateItem(i, { qty: e.target.value })}
                />
                <button type="button" className="btn-secondary" onClick={() => removeItem(i)}>
                  Retirer
                </button>
              </div>
            ))}
            <button type="button" className="btn-secondary" onClick={addItem}>
              + Ajouter un lot
            </button>
          </div>

          <OutilsResultBanner result={createResult} />

          <button type="button" className="btn-primary" disabled={createBusy} onClick={() => void handleCreate()}>
            {createBusy ? "Création…" : "Créer l'override"}
          </button>
        </div>
      )}
    </section>
  );
}
