"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useT } from "@/lib/i18n";
import { shopFetch, fmtMoney, type ShopProduct, type WooList } from "./shop-types";

interface ShopProductsCardProps {
  canWrite: boolean;
}

interface EditDraft {
  regular_price: string;
  sale_price: string;
  stock_quantity: string;
  status: string;
}

// Onglet Produits — table (image, nom, SKU, prix, stock, statut) + édition inline
// prix/stock/statut si canWrite. GET /api/shop/produits ; PATCH /api/shop/produits/[id].
export function ShopProductsCard({ canWrite }: ShopProductsCardProps) {
  const t = useT();
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<EditDraft | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async (searchTerm = "") => {
    setLoading(true);
    setError(null);
    try {
      const qs = searchTerm ? `?search=${encodeURIComponent(searchTerm)}` : "";
      const data = await shopFetch<WooList<ShopProduct>>(`/produits${qs}`);
      setProducts(data.items);
    } catch (e) {
      setProducts([]);
      setError(e instanceof Error ? e.message : t("shop.errorGeneric"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const startEdit = (p: ShopProduct) => {
    setEditingId(p.id);
    setDraft({
      regular_price: p.regular_price ?? "",
      sale_price: p.sale_price ?? "",
      stock_quantity: p.stock_quantity == null ? "" : String(p.stock_quantity),
      status: p.status,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft(null);
  };

  const saveEdit = async (id: number) => {
    if (!draft) return;
    const payload: Record<string, unknown> = {
      regular_price: draft.regular_price,
      sale_price: draft.sale_price,
      status: draft.status,
    };
    if (draft.stock_quantity !== "") {
      payload.manage_stock = true;
      payload.stock_quantity = Number(draft.stock_quantity);
    }
    setSaving(true);
    try {
      await shopFetch(`/produits/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      toast.success(t("shop.saved"));
      cancelEdit();
      await load(search);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("shop.errorGeneric"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="card p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{t("shop.productsTitle")}</h2>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void load(search);
          }}
        >
          <input
            className="input"
            placeholder={t("shop.search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="submit" className="btn-secondary">
            {t("shop.search")}
          </button>
        </form>
      </div>

      {!canWrite && <p className="text-xs text-chanv-terre/50">{t("shop.readOnlyNotice")}</p>}
      {error && (
        <div className="card p-4 border-l-4 border-rose-400 bg-rose-50 text-rose-700 text-sm">{error}</div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-chanv-fibre">
              <th className="px-3 py-2">{t("shop.colImage")}</th>
              <th className="px-3 py-2">{t("shop.colName")}</th>
              <th className="px-3 py-2">{t("shop.colSku")}</th>
              <th className="px-3 py-2">{t("shop.colRegularPrice")}</th>
              <th className="px-3 py-2">{t("shop.colSalePrice")}</th>
              <th className="px-3 py-2">{t("shop.colStock")}</th>
              <th className="px-3 py-2">{t("shop.colStatus")}</th>
              {canWrite && <th className="px-3 py-2" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-chanv-fibre">
            {loading ? (
              <tr>
                <td colSpan={canWrite ? 8 : 7} className="px-3 py-6 text-center text-chanv-terre/50">
                  {t("shop.loading")}
                </td>
              </tr>
            ) : products.length === 0 ? (
              <tr>
                <td colSpan={canWrite ? 8 : 7} className="px-3 py-6 text-center text-chanv-terre/50">
                  {t("shop.empty")}
                </td>
              </tr>
            ) : (
              products.map((p) => {
                const editing = editingId === p.id;
                return (
                  <tr key={p.id}>
                    <td className="px-3 py-2">
                      {p.images?.[0]?.src ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.images[0].src} alt="" className="h-10 w-10 rounded object-cover" />
                      ) : (
                        <div className="h-10 w-10 rounded bg-chanv-fibre" />
                      )}
                    </td>
                    <td className="px-3 py-2 font-medium">{p.name}</td>
                    <td className="px-3 py-2 text-chanv-terre/60">{p.sku || "—"}</td>
                    <td className="px-3 py-2">
                      {editing && draft ? (
                        <input
                          className="input w-24"
                          type="number"
                          step="0.01"
                          min={0}
                          value={draft.regular_price}
                          onChange={(e) => setDraft({ ...draft, regular_price: e.target.value })}
                        />
                      ) : (
                        fmtMoney(p.regular_price)
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {editing && draft ? (
                        <input
                          className="input w-24"
                          type="number"
                          step="0.01"
                          min={0}
                          value={draft.sale_price}
                          onChange={(e) => setDraft({ ...draft, sale_price: e.target.value })}
                        />
                      ) : p.sale_price ? (
                        fmtMoney(p.sale_price)
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {editing && draft ? (
                        <input
                          className="input w-20"
                          type="number"
                          min={0}
                          value={draft.stock_quantity}
                          onChange={(e) => setDraft({ ...draft, stock_quantity: e.target.value })}
                        />
                      ) : p.manage_stock && p.stock_quantity != null ? (
                        p.stock_quantity
                      ) : (
                        t(`shop.stock${capitalize(p.stock_status)}`)
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {editing && draft ? (
                        <select
                          className="input"
                          value={draft.status}
                          onChange={(e) => setDraft({ ...draft, status: e.target.value })}
                        >
                          <option value="publish">{t("shop.statusPublish")}</option>
                          <option value="draft">{t("shop.statusDraft")}</option>
                        </select>
                      ) : (
                        <span className={p.status === "publish" ? "badge-accent" : "badge-neutral"}>
                          {p.status === "publish" ? t("shop.statusPublish") : t("shop.statusDraft")}
                        </span>
                      )}
                    </td>
                    {canWrite && (
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        {editing ? (
                          <div className="flex gap-2 justify-end">
                            <button
                              type="button"
                              className="btn-primary"
                              disabled={saving}
                              onClick={() => void saveEdit(p.id)}
                            >
                              {t("shop.save")}
                            </button>
                            <button type="button" className="btn-secondary" disabled={saving} onClick={cancelEdit}>
                              {t("shop.cancel")}
                            </button>
                          </div>
                        ) : (
                          <button type="button" className="btn-secondary" onClick={() => startEdit(p)}>
                            {t("shop.edit")}
                          </button>
                        )}
                      </td>
                    )}
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

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
