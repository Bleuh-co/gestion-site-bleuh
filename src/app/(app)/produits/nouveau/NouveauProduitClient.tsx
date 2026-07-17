"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Product, ProductInput } from "@/lib/types";
import { ProductForm } from "../ProductForm";
import { useT } from "@/lib/i18n";

export function NouveauProduitClient() {
  const t = useT();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(input: ProductInput) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/produits", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || t("produits.errorStatus", { status: res.status }));
      }
      const product = data as Product;
      toast.success(t("produits.toastCreated"));
      router.push(`/produits/${encodeURIComponent(product.id)}`);
    } catch (e: any) {
      const message = e.message || t("produits.createError");
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-bold mb-6">{t("produits.new")}</h1>
      <ProductForm
        submitLabel={t("produits.createSubmit")}
        saving={saving}
        error={error}
        onSubmit={handleSubmit}
        onCancel={() => router.push("/produits")}
      />
    </main>
  );
}
