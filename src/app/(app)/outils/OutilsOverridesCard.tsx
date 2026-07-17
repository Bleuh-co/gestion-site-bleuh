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
import { useT } from "@/lib/i18n";

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
  const t = useT();
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
      setListResult({ ok: false, message: e instanceof Error ? e.message : t("outils.errorGeneric") });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOverrides();
  }, []);

  const handleDelete = async (row: OverrideRow, index: number) => {
    if (
      !window.confirm(t("outils.confirmDeleteOverride", { lot: row.lot ?? "?", store: row.store ?? "?" }))
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
      setListResult({ ok: true, message: t("outils.deletedWith", { msg: resultMessage(data) }) });
      await loadOverrides();
    } catch (e) {
      setListResult({ ok: false, message: e instanceof Error ? e.message : t("outils.errorGeneric") });
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
      setCreateResult({ ok: false, message: t("outils.overrideRequiredFields") });
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
      setCreateResult({ ok: true, message: t("outils.createdWith", { msg: resultMessage(data) }) });
      resetForm();
      await loadOverrides();
    } catch (e) {
      setCreateResult({ ok: false, message: e instanceof Error ? e.message : t("outils.errorGeneric") });
    } finally {
      setCreateBusy(false);
    }
  };

  return (
    <section className="card p-4 space-y-4">
      <div>
        <h2 className="text-lg font-semibold">{t("outils.overridesTitle")}</h2>
        <p className="text-sm text-chanv-terre/70">{t("outils.overridesIntro")}</p>
      </div>

      <OutilsResultBanner result={listResult} />

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-chanv-fibre">
              <th className="px-4 py-2">{t("outils.store")}</th>
              <th className="px-4 py-2">GTIN</th>
              <th className="px-4 py-2">{t("outils.lot")}</th>
              <th className="px-4 py-2">{t("outils.qty")}</th>
              <th className="px-4 py-2">{t("outils.remaining")}</th>
              <th className="px-4 py-2">{t("outils.order")}</th>
              <th className="px-4 py-2">{t("outils.date")}</th>
              <th className="px-4 py-2">{t("outils.status")}</th>
              {canWrite && <th className="px-4 py-2" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-chanv-fibre">
            {loading ? (
              <tr>
                <td colSpan={canWrite ? 9 : 8} className="px-4 py-6 text-center text-chanv-terre/50">
                  {t("outils.tableLoading")}
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={canWrite ? 9 : 8} className="px-4 py-6 text-center text-chanv-terre/50">
                  {t("outils.overridesEmpty")}
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
                      {r.expired ? t("outils.statusExpired") : t("outils.statusActive")}
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
                        {deleteBusyIndex === i ? t("outils.deleting") : t("outils.delete")}
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
          <h3 className="text-sm font-semibold uppercase tracking-wide text-chanv-terre/70">{t("outils.addOverride")}</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="label">{t("outils.store")}</label>
              <input className="input" value={store} onChange={(e) => setStore(e.target.value)} />
            </div>
            <div>
              <label className="label">GTIN</label>
              <input className="input" value={gtin} onChange={(e) => setGtin(e.target.value)} />
            </div>
            <div>
              <label className="label">{t("outils.liveQtyLabel")}</label>
              <input
                className="input"
                type="number"
                min={0}
                value={liveQty}
                onChange={(e) => setLiveQty(e.target.value)}
              />
            </div>
            <div>
              <label className="label">{t("outils.thresholdLabel")}</label>
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
            <label className="label">{t("outils.lots")}</label>
            {items.map((it, i) => (
              <div key={i} className="flex gap-2 flex-wrap">
                <input
                  className="input flex-1 min-w-[10rem]"
                  placeholder={t("outils.lotNamePlaceholder")}
                  value={it.lot}
                  onChange={(e) => updateItem(i, { lot: e.target.value })}
                />
                <input
                  className="input w-32"
                  type="number"
                  min={0}
                  placeholder={t("outils.qty")}
                  value={it.qty}
                  onChange={(e) => updateItem(i, { qty: e.target.value })}
                />
                <button type="button" className="btn-secondary" onClick={() => removeItem(i)}>
                  {t("outils.remove")}
                </button>
              </div>
            ))}
            <button type="button" className="btn-secondary" onClick={addItem}>
              {t("outils.addLot")}
            </button>
          </div>

          <OutilsResultBanner result={createResult} />

          <button type="button" className="btn-primary" disabled={createBusy} onClick={() => void handleCreate()}>
            {createBusy ? t("outils.creating") : t("outils.createOverride")}
          </button>
        </div>
      )}
    </section>
  );
}
