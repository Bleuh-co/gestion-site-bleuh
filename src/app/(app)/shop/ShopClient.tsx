"use client";

import { useState } from "react";
import type { Role } from "@/lib/types";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { ShopStatsCard } from "./ShopStatsCard";
import { ShopProductsCard } from "./ShopProductsCard";
import { ShopOrdersCard } from "./ShopOrdersCard";
import { ShopCouponsCard } from "./ShopCouponsCard";

interface ShopClientProps {
  role: Role;
}

type Tab = "apercu" | "produits" | "commandes" | "coupons";

// Module Shop — gestion de la boutique Bleuh via l'API /api/shop/* (catalogue
// MAÎTRE dans notre Firestore, collections shop_* — plus de WordPress/Woo).
// L'autorisation réelle est appliquée côté serveur (requireRead/requireWrite
// dans chaque route) — ce gate ne fait qu'adapter l'affichage.
export function ShopClient({ role }: ShopClientProps) {
  const t = useT();
  const canWrite = role === "gestionnaire" || role === "admin" || role === "superadmin";
  const [tab, setTab] = useState<Tab>("apercu");

  const tabs: { key: Tab; label: string }[] = [
    { key: "apercu", label: t("shop.tabApercu") },
    { key: "produits", label: t("shop.tabProduits") },
    { key: "commandes", label: t("shop.tabCommandes") },
    { key: "coupons", label: t("shop.tabCoupons") },
  ];

  return (
    <main className="mx-auto max-w-6xl p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-2">{t("shop.pageTitle")}</h1>
        <p className="text-sm text-chanv-terre/60">{t("shop.pageIntro")}</p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-chanv-fibre">
        {tabs.map((tb) => (
          <button
            key={tb.key}
            type="button"
            onClick={() => setTab(tb.key)}
            className={cn(
              "px-4 py-2 text-sm font-semibold -mb-px border-b-2 transition-colors",
              tab === tb.key
                ? "border-chanv-terre text-chanv-terre"
                : "border-transparent text-chanv-terre/50 hover:text-chanv-terre/80",
            )}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {tab === "apercu" && <ShopStatsCard />}
      {tab === "produits" && <ShopProductsCard canWrite={canWrite} />}
      {tab === "commandes" && <ShopOrdersCard canWrite={canWrite} />}
      {tab === "coupons" && <ShopCouponsCard canWrite={canWrite} />}
    </main>
  );
}
