"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useT } from "@/lib/i18n";
import { shopFetch, type ShopCoupon, type ShopList } from "./shop-types";

interface ShopCouponsCardProps {
  canWrite: boolean;
}

// Onglet Coupons — table + formulaire de création + suppression (window.confirm).
// GET /api/shop/coupons ; POST /api/shop/coupons ; DELETE /api/shop/coupons/[id].
export function ShopCouponsCard({ canWrite }: ShopCouponsCardProps) {
  const t = useT();
  const [coupons, setCoupons] = useState<ShopCoupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyCode, setBusyCode] = useState<string | null>(null);

  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState("percent");
  const [amount, setAmount] = useState("");
  const [usageLimit, setUsageLimit] = useState("");
  const [emails, setEmails] = useState("");
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await shopFetch<ShopList<ShopCoupon>>("/coupons");
      setCoupons(data.items);
    } catch (e) {
      setCoupons([]);
      setError(e instanceof Error ? e.message : t("shop.errorGeneric"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const resetForm = () => {
    setCode("");
    setDiscountType("percent");
    setAmount("");
    setUsageLimit("");
    setEmails("");
  };

  const handleCreate = async () => {
    if (!code.trim() || amount.trim() === "") {
      toast.error(t("shop.errorGeneric"));
      return;
    }
    const payload: Record<string, unknown> = {
      code: code.trim(),
      discount_type: discountType,
      amount: amount.trim(),
    };
    if (usageLimit.trim() !== "") payload.usage_limit = Number(usageLimit);
    const emailList = emails
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean);
    if (emailList.length) payload.email_restrictions = emailList;

    setCreating(true);
    try {
      await shopFetch("/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      toast.success(t("shop.couponCreated"));
      resetForm();
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("shop.errorGeneric"));
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (c: ShopCoupon) => {
    if (!window.confirm(t("shop.confirmDeleteCoupon"))) return;
    setBusyCode(c.code);
    try {
      await shopFetch(`/coupons/${encodeURIComponent(c.code)}`, { method: "DELETE" });
      toast.success(t("shop.couponDeleted"));
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("shop.errorGeneric"));
    } finally {
      setBusyCode(null);
    }
  };

  const typeLabel = (dt: string) =>
    dt === "percent" ? t("shop.typePercent") : dt === "fixed_cart" ? t("shop.typeFixedCart") : dt;

  return (
    <section className="card p-4 space-y-4">
      <h2 className="text-lg font-semibold">{t("shop.couponsTitle")}</h2>

      {!canWrite && <p className="text-xs text-chanv-terre/50">{t("shop.readOnlyNotice")}</p>}
      {error && (
        <div className="card p-4 border-l-4 border-rose-400 bg-rose-50 text-rose-700 text-sm">{error}</div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-chanv-fibre">
              <th className="px-3 py-2">{t("shop.colCode")}</th>
              <th className="px-3 py-2">{t("shop.colType")}</th>
              <th className="px-3 py-2">{t("shop.colAmount")}</th>
              <th className="px-3 py-2">{t("shop.colUsage")}</th>
              {canWrite && <th className="px-3 py-2" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-chanv-fibre">
            {loading ? (
              <tr>
                <td colSpan={canWrite ? 5 : 4} className="px-3 py-6 text-center text-chanv-terre/50">
                  {t("shop.loading")}
                </td>
              </tr>
            ) : coupons.length === 0 ? (
              <tr>
                <td colSpan={canWrite ? 5 : 4} className="px-3 py-6 text-center text-chanv-terre/50">
                  {t("shop.empty")}
                </td>
              </tr>
            ) : (
              coupons.map((c) => (
                <tr key={c.code}>
                  <td className="px-3 py-2 font-medium">{c.code}</td>
                  <td className="px-3 py-2 text-chanv-terre/70">{typeLabel(c.discount_type)}</td>
                  <td className="px-3 py-2">
                    {c.discount_type === "percent" ? `${c.amount} %` : c.amount}
                  </td>
                  <td className="px-3 py-2 text-chanv-terre/70">
                    {c.usage_count}
                    {c.usage_limit != null ? ` / ${c.usage_limit}` : ""}
                  </td>
                  {canWrite && (
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        className="btn-secondary text-rose-600"
                        disabled={busyCode !== null}
                        onClick={() => void handleDelete(c)}
                      >
                        {t("shop.delete")}
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
          <h3 className="text-sm font-semibold uppercase tracking-wide text-chanv-terre/70">
            {t("shop.createCoupon")}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="label">{t("shop.couponCode")}</label>
              <input className="input" value={code} onChange={(e) => setCode(e.target.value)} />
            </div>
            <div>
              <label className="label">{t("shop.colType")}</label>
              <select className="input" value={discountType} onChange={(e) => setDiscountType(e.target.value)}>
                <option value="percent">{t("shop.typePercent")}</option>
                <option value="fixed_cart">{t("shop.typeFixedCart")}</option>
              </select>
            </div>
            <div>
              <label className="label">{t("shop.couponAmount")}</label>
              <input
                className="input"
                type="number"
                step="0.01"
                min={0}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div>
              <label className="label">{t("shop.couponUsageLimit")}</label>
              <input
                className="input"
                type="number"
                min={0}
                value={usageLimit}
                onChange={(e) => setUsageLimit(e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label">{t("shop.couponEmailRestrictions")}</label>
              <input className="input" value={emails} onChange={(e) => setEmails(e.target.value)} />
            </div>
          </div>
          <button type="button" className="btn-primary" disabled={creating} onClick={() => void handleCreate()}>
            {t("shop.create")}
          </button>
        </div>
      )}
    </section>
  );
}
