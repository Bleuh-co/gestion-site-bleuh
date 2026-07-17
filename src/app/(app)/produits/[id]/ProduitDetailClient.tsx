"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Product, ProductInput, Role } from "@/lib/types";
import { ProductForm } from "../ProductForm";
import { statusBadgeClass } from "../constants";
import { useT } from "@/lib/i18n";

interface ProduitDetailClientProps {
  id: string;
  role: Role;
}

export function ProduitDetailClient({ id, role }: ProduitDetailClientProps) {
  const t = useT();
  const router = useRouter();
  const canWrite = role === "gestionnaire" || role === "admin" || role === "superadmin";

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    setLoadError(null);
    fetch(`/api/produits/${encodeURIComponent(id)}`, { cache: "no-store" })
      .then(async (res) => {
        if (res.status === 404) {
          if (!cancelled) setNotFound(true);
          return null;
        }
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || t("produits.errorStatus", { status: res.status }));
        }
        return res.json();
      })
      .then((data: Product | null) => {
        if (!cancelled && data) setProduct(data);
      })
      .catch((e) => {
        if (!cancelled) setLoadError(e.message || t("produits.loadDetailError"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, t]);

  async function handleSave(input: ProductInput) {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/produits/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || t("produits.errorStatus", { status: res.status }));
      }
      setProduct(data as Product);
      setEditing(false);
      toast.success(t("produits.toastUpdated"));
    } catch (e: any) {
      const message = e.message || t("produits.saveChangesError");
      setSaveError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive() {
    if (!product) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/produits/${encodeURIComponent(id)}/archive`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t("produits.errorStatus", { status: res.status }));
      setProduct({ ...product, status: "archived" });
      toast.success(t("produits.toastArchived"));
    } catch (e: any) {
      toast.error(e.message || t("produits.archiveError"));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!product) return;
    if (!window.confirm(t("produits.deleteConfirm", { name: product.name?.fr || product.id }))) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/produits/${encodeURIComponent(id)}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t("produits.errorStatus", { status: res.status }));
      toast.success(t("produits.toastDeleted"));
      router.push("/produits");
    } catch (e: any) {
      toast.error(e.message || t("produits.deleteError"));
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-5xl p-6">
        <div className="card p-8 text-center text-gray-400">{t("produits.loading")}</div>
      </main>
    );
  }

  if (notFound) {
    return (
      <main className="mx-auto max-w-5xl p-6">
        <h1 className="text-2xl font-bold mb-6">{t("produits.notFoundTitle")}</h1>
        <div className="card p-8 text-center text-gray-400">
          <p>{t("produits.notFoundBody", { id })}</p>
        </div>
      </main>
    );
  }

  if (loadError || !product) {
    return (
      <main className="mx-auto max-w-5xl p-6">
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {loadError || t("produits.unknownError")}
        </div>
      </main>
    );
  }

  if (editing) {
    return (
      <main className="mx-auto max-w-5xl p-6">
        <h1 className="text-2xl font-bold mb-6">{t("produits.editTitle", { name: product.name?.fr ?? "" })}</h1>
        <ProductForm
          initial={product}
          submitLabel={t("common.save")}
          saving={saving}
          error={saveError}
          onSubmit={handleSave}
          onCancel={() => {
            setEditing(false);
            setSaveError(null);
          }}
        />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl p-6">
      <div className="flex items-start justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold">{product.name?.fr || t("produits.noName")}</h1>
          <p className="text-sm text-chanv-terre/60">{product.name?.en}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`badge ${statusBadgeClass(product.status)}`}>{t("produits.status." + product.status)}</span>
          {canWrite && (
            <>
              <button className="btn-secondary" onClick={() => setEditing(true)} disabled={busy}>
                {t("common.edit")}
              </button>
              {product.status !== "archived" && (
                <button className="btn-secondary" onClick={handleArchive} disabled={busy}>
                  {t("produits.archive")}
                </button>
              )}
              <button
                className="btn-secondary text-rose-600"
                onClick={handleDelete}
                disabled={busy}
              >
                {t("common.delete")}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {product.images?.main && (
          <div className="card p-4 sm:col-span-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={product.images.main} alt={product.name?.fr || ""} className="w-full rounded-lg object-cover" />
            {(product.images.gallery?.length ?? 0) > 0 && (
              <div className="grid grid-cols-3 gap-2 mt-2">
                {(product.images.gallery ?? []).map((url) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={url} src={url} alt="" className="w-full aspect-square rounded object-cover" />
                ))}
              </div>
            )}
          </div>
        )}

        <div className={`card p-6 space-y-4 ${product.images?.main ? "sm:col-span-2" : "sm:col-span-3"}`}>
          <dl className="grid gap-3 sm:grid-cols-2 text-sm">
            <Field label={t("produits.collection")} value={product.collection} />
            <Field label={t("produits.brand")} value={product.brand} />
            <Field label={t("produits.category")} value={t("produits.strain." + product.strain)} />
            <Field label={t("produits.format")} value={product.formatSlug} />
            <Field label={t("produits.weight")} value={product.weight} />
            <Field label="THC" value={product.thc} />
            <Field
              label="THC min / max"
              value={product.thcMin != null || product.thcMax != null ? `${product.thcMin ?? "—"} / ${product.thcMax ?? "—"}` : null}
            />
            <Field label={t("produits.provinces")} value={(product.provinces || []).map((p) => t("produits.province." + p)).join(", ")} />
            <Field label="SKU" value={product.sku} />
            <Field label="GTIN" value={product.gtin} />
            <Field label="Slug" value={product.slug?.fr} />
          </dl>

          <div className="flex flex-wrap gap-2">
            {product.isNew && <span className="badge-accent">{t("produits.flagNew")}</span>}
            {product.isWebOnly && <span className="badge-accent">{t("produits.flagWebOnly")}</span>}
            {product.isComingSoon && <span className="badge-accent">{t("produits.flagComingSoon")}</span>}
            {(product.tags || []).map((tag) => (
              <span key={tag} className="badge-neutral">
                {tag}
              </span>
            ))}
          </div>

          {(product.description?.fr || product.description?.en) && (
            <div>
              <h3 className="label">{t("produits.descriptionHeading")}</h3>
              <p className="text-sm whitespace-pre-wrap">{product.description.fr}</p>
              {product.description.en && <p className="text-sm text-chanv-terre/60 whitespace-pre-wrap mt-1">{product.description.en}</p>}
            </div>
          )}

          <div className="grid gap-2 sm:grid-cols-2 text-xs text-chanv-terre/40 pt-2 border-t border-chanv-fibre">
            <span>{t("produits.createdOn", { date: formatDate(product.createdAt) })}</span>
            <span>{t("produits.updatedOn", { date: formatDate(product.updatedAt) })}</span>
          </div>
        </div>
      </div>
    </main>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs font-bold uppercase tracking-wide text-chanv-terre/40">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function formatDate(iso: string | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("fr-CA");
  } catch {
    return iso;
  }
}
