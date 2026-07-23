"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";
import { shopFetch, fmtMoney, orderStatusLabelKey, type ShopStats } from "./shop-types";

// Onglet Aperçu — compteurs de commandes par statut, ventes du mois, top
// vendeurs, agrégés depuis NOS commandes (Firestore shop_orders).
// Lecture seule (GET /api/shop/stats, requireRead).
export function ShopStatsCard() {
  const t = useT();
  const [stats, setStats] = useState<ShopStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await shopFetch<ShopStats>("/stats");
      setStats(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("shop.errorGeneric"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  if (loading) {
    return <div className="card p-8 text-center text-gray-400">{t("shop.loading")}</div>;
  }
  if (error) {
    return (
      <div className="card p-4 border-l-4 border-rose-400 bg-rose-50 text-rose-700 text-sm">{error}</div>
    );
  }

  const totals = stats?.totals ?? [];
  const sales = stats?.sales?.[0];
  const topSellers = stats?.topSellers ?? [];

  return (
    <div className="grid gap-6 md:grid-cols-3">
      <section className="card p-4 space-y-3">
        <h2 className="text-lg font-semibold">{t("shop.statsOrdersByStatus")}</h2>
        {totals.length === 0 ? (
          <p className="text-sm text-chanv-terre/50">{t("shop.statsNoData")}</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {totals.map((row) => (
              <li key={row.slug} className="flex justify-between">
                <span className="text-chanv-terre/70">{t(orderStatusLabelKey(row.slug))}</span>
                <span className="font-semibold">{row.total}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card p-4 space-y-3">
        <h2 className="text-lg font-semibold">{t("shop.statsSalesMonth")}</h2>
        {!sales ? (
          <p className="text-sm text-chanv-terre/50">{t("shop.statsNoData")}</p>
        ) : (
          <div className="space-y-1 text-sm">
            <div className="text-3xl font-bold">{fmtMoney(sales.total_sales)}</div>
            <div className="text-chanv-terre/70">
              {sales.total_orders ?? 0} {t("shop.tabCommandes").toLowerCase()} · {sales.total_items ?? 0}{" "}
              {t("shop.statsUnits")}
            </div>
          </div>
        )}
      </section>

      <section className="card p-4 space-y-3">
        <h2 className="text-lg font-semibold">{t("shop.statsTopSellers")}</h2>
        {topSellers.length === 0 ? (
          <p className="text-sm text-chanv-terre/50">{t("shop.statsNoData")}</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {topSellers.slice(0, 8).map((row) => (
              <li key={row.product_id} className="flex justify-between gap-2">
                <span className="text-chanv-terre/70 truncate">{row.name}</span>
                <span className="font-semibold whitespace-nowrap">
                  {row.quantity} {t("shop.statsUnits")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
