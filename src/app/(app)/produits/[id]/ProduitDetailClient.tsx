"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Product, ProductInput, Role } from "@/lib/types";
import { ProductForm } from "../ProductForm";
import { PROVINCE_LABELS, STATUS_LABELS, STRAIN_LABELS, statusBadgeClass } from "../constants";

interface ProduitDetailClientProps {
  id: string;
  role: Role;
}

export function ProduitDetailClient({ id, role }: ProduitDetailClientProps) {
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
          throw new Error(err.error || `Erreur ${res.status}`);
        }
        return res.json();
      })
      .then((data: Product | null) => {
        if (!cancelled && data) setProduct(data);
      })
      .catch((e) => {
        if (!cancelled) setLoadError(e.message || "Impossible de charger le produit.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

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
        throw new Error(data.error || `Erreur ${res.status}`);
      }
      setProduct(data as Product);
      setEditing(false);
      toast.success("Produit mis à jour.");
    } catch (e: any) {
      const message = e.message || "Impossible d'enregistrer les modifications.";
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
      if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
      setProduct({ ...product, status: "archived" });
      toast.success("Produit archivé.");
    } catch (e: any) {
      toast.error(e.message || "Impossible d'archiver le produit.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!product) return;
    if (!window.confirm(`Supprimer définitivement « ${product.name?.fr || product.id} » ? Cette action est irréversible.`)) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/produits/${encodeURIComponent(id)}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
      toast.success("Produit supprimé.");
      router.push("/produits");
    } catch (e: any) {
      toast.error(e.message || "Impossible de supprimer le produit.");
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-5xl p-6">
        <div className="card p-8 text-center text-gray-400">Chargement…</div>
      </main>
    );
  }

  if (notFound) {
    return (
      <main className="mx-auto max-w-5xl p-6">
        <h1 className="text-2xl font-bold mb-6">Produit introuvable</h1>
        <div className="card p-8 text-center text-gray-400">
          <p>Aucun produit avec l'identifiant « {id} ».</p>
        </div>
      </main>
    );
  }

  if (loadError || !product) {
    return (
      <main className="mx-auto max-w-5xl p-6">
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {loadError || "Erreur inconnue."}
        </div>
      </main>
    );
  }

  if (editing) {
    return (
      <main className="mx-auto max-w-5xl p-6">
        <h1 className="text-2xl font-bold mb-6">Modifier « {product.name?.fr} »</h1>
        <ProductForm
          initial={product}
          submitLabel="Enregistrer"
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
          <h1 className="text-2xl font-bold">{product.name?.fr || "(sans nom)"}</h1>
          <p className="text-sm text-chanv-terre/60">{product.name?.en}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`badge ${statusBadgeClass(product.status)}`}>{STATUS_LABELS[product.status] ?? product.status}</span>
          {canWrite && (
            <>
              <button className="btn-secondary" onClick={() => setEditing(true)} disabled={busy}>
                Modifier
              </button>
              {product.status !== "archived" && (
                <button className="btn-secondary" onClick={handleArchive} disabled={busy}>
                  Archiver
                </button>
              )}
              <button
                className="btn-secondary text-rose-600"
                onClick={handleDelete}
                disabled={busy}
              >
                Supprimer
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
            <Field label="Collection" value={product.collection} />
            <Field label="Marque" value={product.brand} />
            <Field label="Catégorie" value={STRAIN_LABELS[product.strain] ?? product.strain} />
            <Field label="Format" value={product.formatSlug} />
            <Field label="Poids" value={product.weight} />
            <Field label="THC" value={product.thc} />
            <Field
              label="THC min / max"
              value={product.thcMin != null || product.thcMax != null ? `${product.thcMin ?? "—"} / ${product.thcMax ?? "—"}` : null}
            />
            <Field label="Provinces" value={(product.provinces || []).map((p) => PROVINCE_LABELS[p] ?? p).join(", ")} />
            <Field label="SKU" value={product.sku} />
            <Field label="GTIN" value={product.gtin} />
            <Field label="Slug" value={product.slug?.fr} />
          </dl>

          <div className="flex flex-wrap gap-2">
            {product.isNew && <span className="badge-accent">Nouveauté</span>}
            {product.isWebOnly && <span className="badge-accent">Web seulement</span>}
            {product.isComingSoon && <span className="badge-accent">À venir</span>}
            {(product.tags || []).map((t) => (
              <span key={t} className="badge-neutral">
                {t}
              </span>
            ))}
          </div>

          {(product.description?.fr || product.description?.en) && (
            <div>
              <h3 className="label">Description</h3>
              <p className="text-sm whitespace-pre-wrap">{product.description.fr}</p>
              {product.description.en && <p className="text-sm text-chanv-terre/60 whitespace-pre-wrap mt-1">{product.description.en}</p>}
            </div>
          )}

          <div className="grid gap-2 sm:grid-cols-2 text-xs text-chanv-terre/40 pt-2 border-t border-chanv-fibre">
            <span>Créé le {formatDate(product.createdAt)}</span>
            <span>Modifié le {formatDate(product.updatedAt)}</span>
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
