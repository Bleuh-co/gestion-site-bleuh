"use client";

import { useMemo, useState } from "react";
import type { Product, ProductFormInput, ProductProvince, ProductStatus, ProductStrain } from "@/lib/types";
import { KNOWN_COLLECTIONS, PROVINCE_LABELS, STATUS_LABELS, STRAIN_LABELS } from "./constants";

// Formulaire de création/édition produit — champs du vrai schéma
// (validateProductInput), porté depuis le formulaire admin
// Formulaire DB-Products-Master/public/site-products.js.
//
// Champs volontairement hors formulaire (édition avancée future, pas dans
// le brief cœur) : badges, rotationVarieties, relatedProducts,
// currentRotation, wpPostId, url.
//
// ATTENTION — ils doivent rester ABSENTS du payload, pas envoyés à vide.
// buildInput les émettait avec [] / null : à chaque « Enregistrer », le
// produit perdait ses variétés en rotation, ses badges, ses produits liés
// et son wpPostId. La route PATCH fusionne `{ ...doc.data(), ...body }`, donc
// une clé présente écrase toujours l'existant — même vide. Le type
// ProductFormInput (lib/types.ts) matérialise cette omission côté
// compilateur pour que la régression ne puisse pas revenir en silence.

// Emplacement d'une image dans le produit : la vignette principale ou la galerie.
type ImageTarget = "main" | "gallery";

interface StudioAsset {
  id: string;
  displayName: string;
  thumbUrl: string;
  format: string;
}

// Doit rester aligné sur ALLOWED_IMAGE_MIME (lib/product-images.ts).
const ACCEPTED_IMAGE_TYPES = "image/png,image/jpeg,image/webp,image/gif,image/avif,image/svg+xml";

function emptyLocalized() {
  return { fr: "", en: "" };
}

function toFormState(p?: Product | null) {
  return {
    name: p?.name ?? emptyLocalized(),
    slug: p?.slug ?? emptyLocalized(),
    collection: p?.collection ?? "",
    collectionCustom: p && !KNOWN_COLLECTIONS.includes(p.collection as (typeof KNOWN_COLLECTIONS)[number]) ? p.collection : "",
    brand: p?.brand ?? "",
    strain: (p?.strain ?? "hybrid") as ProductStrain,
    tags: (p?.tags ?? []).join(", "),
    formatSlug: p?.formatSlug ?? "",
    weight: p?.weight ?? "",
    thc: p?.thc ?? "",
    thcMin: p?.thcMin ?? null,
    thcMax: p?.thcMax ?? null,
    cbd: p?.cbd ?? "",
    cbdMin: p?.cbdMin ?? null,
    cbdMax: p?.cbdMax ?? null,
    provinces: (p?.provinces ?? []) as ProductProvince[],
    isNew: p?.isNew ?? false,
    isWebOnly: p?.isWebOnly ?? false,
    isComingSoon: p?.isComingSoon ?? false,
    description: p?.description ?? emptyLocalized(),
    metaDescription: p?.metaDescription ?? emptyLocalized(),
    details: {
      format: p?.details?.format ?? emptyLocalized(),
      variety: p?.details?.variety ?? emptyLocalized(),
      effects: p?.details?.effects ?? emptyLocalized(),
      terpenes: p?.details?.terpenes ?? emptyLocalized(),
      growLocation: p?.details?.growLocation ?? emptyLocalized(),
      distribution: p?.details?.distribution ?? emptyLocalized(),
    },
    imagesMain: p?.images?.main ?? "",
    imagesGallery: (p?.images?.gallery ?? []).join(", "),
    buyLink: p?.buyLink ?? { fr: null, en: null },
    ocsLink: p?.ocsLink ?? "",
    gtin: p?.gtin ?? "",
    sku: p?.sku ?? "",
    sourceNotes: p?.sourceNotes ?? "",
    status: (p?.status ?? "draft") as ProductStatus,
  };
}

export type ProductFormState = ReturnType<typeof toFormState>;

function buildInput(f: ProductFormState): ProductFormInput {
  const collection = f.collection === "__other__" ? f.collectionCustom.trim() : f.collection;
  return {
    slug: { fr: f.slug.fr.trim(), en: f.slug.en.trim() },
    name: { fr: f.name.fr.trim(), en: f.name.en.trim() },
    collection,
    brand: f.brand.trim() || null,
    strain: f.strain,
    tags: f.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
    formatSlug: f.formatSlug.trim(),
    weight: f.weight.trim(),
    thc: f.thc.trim(),
    thcMin: f.thcMin,
    thcMax: f.thcMax,
    cbd: f.cbd.trim(),
    cbdMin: f.cbdMin,
    cbdMax: f.cbdMax,
    provinces: f.provinces,
    isNew: f.isNew,
    isWebOnly: f.isWebOnly,
    isComingSoon: f.isComingSoon,
    description: { fr: f.description.fr, en: f.description.en },
    metaDescription: { fr: f.metaDescription.fr, en: f.metaDescription.en },
    details: f.details,
    images: {
      main: f.imagesMain.trim(),
      gallery: f.imagesGallery
        .split(",")
        .map((u) => u.trim())
        .filter(Boolean),
    },
    buyLink:
      f.buyLink.fr || f.buyLink.en ? { fr: f.buyLink.fr || null, en: f.buyLink.en || null } : null,
    ocsLink: f.ocsLink.trim() || null,
    gtin: f.gtin.trim() || null,
    sku: f.sku.trim() || null,
    sourceNotes: f.sourceNotes.trim() || null,
    status: f.status,
  };
}

interface ProductFormProps {
  initial?: Product | null;
  submitLabel: string;
  saving: boolean;
  error?: string | null;
  onSubmit: (input: ProductFormInput) => void | Promise<void>;
  onCancel?: () => void;
}

export function ProductForm({ initial, submitLabel, saving, error, onSubmit, onCancel }: ProductFormProps) {
  const [f, setF] = useState<ProductFormState>(() => toFormState(initial));

  // Images : téléversement et reprise depuis la bibliothèque Studio Chanv.
  const [uploading, setUploading] = useState<ImageTarget | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [studioTarget, setStudioTarget] = useState<ImageTarget | null>(null);
  const [studioQuery, setStudioQuery] = useState("");
  const [studioAssets, setStudioAssets] = useState<StudioAsset[]>([]);
  const [studioLoading, setStudioLoading] = useState(false);
  const [studioMessage, setStudioMessage] = useState<string | null>(null);

  const galleryUrls = useMemo(
    () =>
      f.imagesGallery
        .split(",")
        .map((u) => u.trim())
        .filter(Boolean),
    [f.imagesGallery]
  );

  const collectionIsKnown = useMemo(
    () => f.collection === "" || KNOWN_COLLECTIONS.includes(f.collection as (typeof KNOWN_COLLECTIONS)[number]),
    [f.collection]
  );

  function update<K extends keyof ProductFormState>(key: K, value: ProductFormState[K]) {
    setF((prev) => ({ ...prev, [key]: value }));
  }

  function updateLocalized(key: "name" | "slug" | "description" | "metaDescription", lang: "fr" | "en", value: string) {
    setF((prev) => ({ ...prev, [key]: { ...prev[key], [lang]: value } }));
  }

  function updateDetail(field: keyof ProductFormState["details"], lang: "fr" | "en", value: string) {
    setF((prev) => ({
      ...prev,
      details: { ...prev.details, [field]: { ...prev.details[field], [lang]: value } },
    }));
  }

  function toggleProvince(p: ProductProvince) {
    setF((prev) => ({
      ...prev,
      provinces: prev.provinces.includes(p) ? prev.provinces.filter((x) => x !== p) : [...prev.provinces, p],
    }));
  }

  function handleNameFrChange(value: string) {
    setF((prev) => ({
      ...prev,
      name: { ...prev.name, fr: value },
      // Dérive le slug FR tant que l'utilisateur ne l'a pas édité lui-même
      // (même logique que slugify côté serveur, appliquée ici pour l'UX).
      slug:
        prev.slug.fr && prev.slug.fr !== slugifyPreview(prev.name.fr)
          ? prev.slug
          : { ...prev.slug, fr: slugifyPreview(value) },
    }));
  }

  function slugifyPreview(value: string): string {
    return value
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(buildInput(f));
  }

  // ── Images ───────────────────────────────────────────────────────────
  // Le téléversement ne fait que RENSEIGNER le champ : c'est « Enregistrer »
  // qui écrit le produit. Un seul écrivain sur `images`, donc pas de risque
  // d'écraser une modification faite en parallèle dans le formulaire.

  function applyImageUrl(target: ImageTarget, url: string) {
    setF((prev) => {
      if (target === "main") return { ...prev, imagesMain: url };
      const existing = prev.imagesGallery
        .split(",")
        .map((u) => u.trim())
        .filter(Boolean);
      if (existing.includes(url)) return prev;
      return { ...prev, imagesGallery: [...existing, url].join(", ") };
    });
  }

  function removeGalleryUrl(url: string) {
    update("imagesGallery", galleryUrls.filter((u) => u !== url).join(", "));
  }

  async function uploadImageFile(target: ImageTarget, file: File | null) {
    if (!file) return;
    setImageError(null);
    setUploading(target);
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (f.name.fr.trim()) fd.append("productName", f.name.fr.trim());
      const res = await fetch("/api/produits/image", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Le téléversement a échoué (${res.status}).`);
      applyImageUrl(target, data.url);
    } catch (err) {
      setImageError(err instanceof Error ? err.message : "Le téléversement a échoué.");
    } finally {
      setUploading(null);
    }
  }

  async function loadStudioAssets(q: string) {
    setStudioLoading(true);
    setStudioMessage(null);
    try {
      const res = await fetch(`/api/produits/studio/search?q=${encodeURIComponent(q)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Studio Chanv a répondu ${res.status}.`);
      setStudioAssets(Array.isArray(data.assets) ? data.assets : []);
      if (data.unavailable && data.message) setStudioMessage(data.message);
    } catch (err) {
      setStudioAssets([]);
      setStudioMessage(err instanceof Error ? err.message : "Chargement impossible.");
    } finally {
      setStudioLoading(false);
    }
  }

  function openStudioPicker(target: ImageTarget) {
    setImageError(null);
    setStudioTarget(target);
    void loadStudioAssets(studioQuery);
  }

  async function pickStudioAsset(asset: StudioAsset) {
    if (!studioTarget) return;
    const target = studioTarget;
    setImageError(null);
    setUploading(target);
    try {
      const res = await fetch("/api/produits/image-from-studio", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ assetId: asset.id, filename: asset.displayName }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Reprise impossible (${res.status}).`);
      applyImageUrl(target, data.url);
      setStudioTarget(null);
    } catch (err) {
      setImageError(err instanceof Error ? err.message : "Reprise impossible.");
    } finally {
      setUploading(null);
    }
  }

  function imageActions(target: ImageTarget) {
    const busy = uploading === target;
    const disabled = busy || saving || uploading !== null;
    return (
      <div className="flex flex-wrap items-center gap-2">
        <label
          className={`btn-secondary cursor-pointer ${disabled ? "pointer-events-none opacity-60" : ""}`}
        >
          {busy ? "Téléversement…" : "Téléverser une image"}
          <input
            type="file"
            className="sr-only"
            accept={ACCEPTED_IMAGE_TYPES}
            disabled={disabled}
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              // Réinitialise pour que re-choisir le MÊME fichier redéclenche.
              e.target.value = "";
              void uploadImageFile(target, file);
            }}
          />
        </label>
        <button
          type="button"
          className="btn-secondary"
          disabled={disabled}
          onClick={() => openStudioPicker(target)}
        >
          Choisir dans Studio Chanv
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      )}

      <section className="card p-6 space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-chanv-terre/60">Identité</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label label-required">Nom (FR)</label>
            <input
              className="input"
              required
              value={f.name.fr}
              onChange={(e) => handleNameFrChange(e.target.value)}
            />
          </div>
          <div>
            <label className="label label-required">Nom (EN)</label>
            <input
              className="input"
              required
              value={f.name.en}
              onChange={(e) => updateLocalized("name", "en", e.target.value)}
            />
          </div>
          <div>
            <label className="label">Slug (FR)</label>
            <input className="input" value={f.slug.fr} onChange={(e) => updateLocalized("slug", "fr", e.target.value)} placeholder="dérivé du nom si vide" />
          </div>
          <div>
            <label className="label">Slug (EN)</label>
            <input className="input" value={f.slug.en} onChange={(e) => updateLocalized("slug", "en", e.target.value)} placeholder="dérivé du nom si vide" />
          </div>
          <div>
            <label className="label label-required">Collection</label>
            <select
              className="input"
              required
              value={collectionIsKnown ? f.collection : "__other__"}
              onChange={(e) => update("collection", e.target.value)}
            >
              <option value="">Sélectionner…</option>
              {KNOWN_COLLECTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
              <option value="__other__">Autre…</option>
            </select>
            {!collectionIsKnown && (
              <input
                className="input mt-2"
                placeholder="Nom de collection libre"
                value={f.collectionCustom}
                onChange={(e) => update("collectionCustom", e.target.value)}
              />
            )}
          </div>
          <div>
            <label className="label">Marque</label>
            <input className="input" value={f.brand} onChange={(e) => update("brand", e.target.value)} />
          </div>
          <div>
            <label className="label">Statut</label>
            <select className="input" value={f.status} onChange={(e) => update("status", e.target.value as ProductStatus)}>
              {(Object.keys(STATUS_LABELS) as ProductStatus[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Catégorie (strain)</label>
            <select className="input" value={f.strain} onChange={(e) => update("strain", e.target.value as ProductStrain)}>
              {(Object.keys(STRAIN_LABELS) as ProductStrain[]).map((s) => (
                <option key={s} value={s}>
                  {STRAIN_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="label label-required">Provinces</label>
          <div className="flex gap-4">
            {(Object.keys(PROVINCE_LABELS) as ProductProvince[]).map((p) => (
              <label key={p} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={f.provinces.includes(p)} onChange={() => toggleProvince(p)} />
                {PROVINCE_LABELS[p]}
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.isNew} onChange={(e) => update("isNew", e.target.checked)} />
            Nouveauté
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.isWebOnly} onChange={(e) => update("isWebOnly", e.target.checked)} />
            Web seulement
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.isComingSoon} onChange={(e) => update("isComingSoon", e.target.checked)} />
            À venir
          </label>
        </div>

        <div>
          <label className="label">Tags (séparés par virgule)</label>
          <input className="input" value={f.tags} onChange={(e) => update("tags", e.target.value)} />
        </div>
      </section>

      <section className="card p-6 space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-chanv-terre/60">Format & THC</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="label">Format (slug)</label>
            <input className="input" value={f.formatSlug} onChange={(e) => update("formatSlug", e.target.value)} />
          </div>
          <div>
            <label className="label">Poids</label>
            <input className="input" value={f.weight} onChange={(e) => update("weight", e.target.value)} placeholder="ex. 3.5 g" />
          </div>
          <div>
            <label className="label">THC (étiquette)</label>
            <input className="input" value={f.thc} onChange={(e) => update("thc", e.target.value)} placeholder="ex. 18-24%" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">THC min</label>
              <input
                type="number"
                step="0.01"
                className="input"
                value={f.thcMin ?? ""}
                onChange={(e) => update("thcMin", e.target.value === "" ? null : Number(e.target.value))}
              />
            </div>
            <div>
              <label className="label">THC max</label>
              <input
                type="number"
                step="0.01"
                className="input"
                value={f.thcMax ?? ""}
                onChange={(e) => update("thcMax", e.target.value === "" ? null : Number(e.target.value))}
              />
            </div>
          </div>
          <div>
            <label className="label">CBD (étiquette)</label>
            <input className="input" value={f.cbd} onChange={(e) => update("cbd", e.target.value)} placeholder="ex. CBD 20-26%" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">CBD min</label>
              <input
                type="number"
                step="0.01"
                className="input"
                value={f.cbdMin ?? ""}
                onChange={(e) => update("cbdMin", e.target.value === "" ? null : Number(e.target.value))}
              />
            </div>
            <div>
              <label className="label">CBD max</label>
              <input
                type="number"
                step="0.01"
                className="input"
                value={f.cbdMax ?? ""}
                onChange={(e) => update("cbdMax", e.target.value === "" ? null : Number(e.target.value))}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="card p-6 space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-chanv-terre/60">Descriptions</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Description (FR)</label>
            <textarea className="input min-h-[6rem]" value={f.description.fr} onChange={(e) => updateLocalized("description", "fr", e.target.value)} />
          </div>
          <div>
            <label className="label">Description (EN)</label>
            <textarea className="input min-h-[6rem]" value={f.description.en} onChange={(e) => updateLocalized("description", "en", e.target.value)} />
          </div>
          <div>
            <label className="label">Méta-description (FR)</label>
            <textarea className="input min-h-[4rem]" value={f.metaDescription.fr} onChange={(e) => updateLocalized("metaDescription", "fr", e.target.value)} />
          </div>
          <div>
            <label className="label">Méta-description (EN)</label>
            <textarea className="input min-h-[4rem]" value={f.metaDescription.en} onChange={(e) => updateLocalized("metaDescription", "en", e.target.value)} />
          </div>
        </div>
      </section>

      <section className="card p-6 space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-chanv-terre/60">Détails produit</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {(Object.keys(f.details) as (keyof ProductFormState["details"])[]).map((field) => (
            <div key={field} className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="label capitalize">{detailLabel(field)} (FR)</label>
                <input className="input" value={f.details[field].fr} onChange={(e) => updateDetail(field, "fr", e.target.value)} />
              </div>
              <div>
                <label className="label capitalize">{detailLabel(field)} (EN)</label>
                <input className="input" value={f.details[field].en} onChange={(e) => updateDetail(field, "en", e.target.value)} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card p-6 space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-chanv-terre/60">Images & liens</h2>
        {imageError && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {imageError}
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="label">Image principale</label>
            {f.imagesMain ? (
              <div className="flex items-start gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={f.imagesMain}
                  alt="Aperçu de l'image principale"
                  className="h-24 w-24 rounded-lg border border-chanv-terre/15 bg-white object-contain"
                />
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={saving || uploading !== null}
                  onClick={() => update("imagesMain", "")}
                >
                  Retirer
                </button>
              </div>
            ) : (
              <p className="text-sm text-chanv-terre/50">Aucune image pour l&apos;instant.</p>
            )}
            {imageActions("main")}
            <input
              className="input"
              value={f.imagesMain}
              placeholder="…ou coller une adresse d'image"
              onChange={(e) => update("imagesMain", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="label">Galerie</label>
            {galleryUrls.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {galleryUrls.map((url) => (
                  <div key={url} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt="Image de la galerie"
                      className="h-24 w-24 rounded-lg border border-chanv-terre/15 bg-white object-contain"
                    />
                    <button
                      type="button"
                      aria-label="Retirer cette image de la galerie"
                      className="absolute -right-2 -top-2 h-6 w-6 rounded-full border border-chanv-terre/20 bg-white text-sm leading-none text-chanv-terre/70 shadow-sm hover:text-red-600"
                      disabled={saving || uploading !== null}
                      onClick={() => removeGalleryUrl(url)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-chanv-terre/50">Aucune image dans la galerie.</p>
            )}
            {imageActions("gallery")}
            <input
              className="input"
              value={f.imagesGallery}
              placeholder="…ou coller des adresses séparées par des virgules"
              onChange={(e) => update("imagesGallery", e.target.value)}
            />
          </div>
          <div>
            <label className="label">Lien d'achat (FR)</label>
            <input className="input" value={f.buyLink.fr ?? ""} onChange={(e) => update("buyLink", { ...f.buyLink, fr: e.target.value })} />
          </div>
          <div>
            <label className="label">Lien d'achat (EN)</label>
            <input className="input" value={f.buyLink.en ?? ""} onChange={(e) => update("buyLink", { ...f.buyLink, en: e.target.value })} />
          </div>
          <div>
            <label className="label">Lien OCS</label>
            <input className="input" value={f.ocsLink} onChange={(e) => update("ocsLink", e.target.value)} />
          </div>
        </div>

        {studioTarget && (
          <div className="space-y-3 rounded-xl border border-chanv-terre/15 bg-white/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold uppercase tracking-wide text-chanv-terre/60">
                Studio Chanv — images Bleuh
                {studioTarget === "gallery" ? " (galerie)" : " (image principale)"}
              </h3>
              <button type="button" className="btn-secondary" onClick={() => setStudioTarget(null)}>
                Fermer
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              <input
                className="input flex-1"
                value={studioQuery}
                placeholder="Filtrer par nom…"
                onChange={(e) => setStudioQuery(e.target.value)}
                onKeyDown={(e) => {
                  // Entrée ne doit PAS soumettre le formulaire produit.
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void loadStudioAssets(studioQuery);
                  }
                }}
              />
              <button
                type="button"
                className="btn-secondary"
                disabled={studioLoading}
                onClick={() => void loadStudioAssets(studioQuery)}
              >
                Filtrer
              </button>
            </div>

            {studioLoading && <p className="text-sm text-chanv-terre/60">Chargement…</p>}
            {studioMessage && <p className="text-sm text-chanv-terre/70">{studioMessage}</p>}
            {!studioLoading && !studioMessage && studioAssets.length === 0 && (
              <p className="text-sm text-chanv-terre/60">Aucune image ne correspond.</p>
            )}

            {studioAssets.length > 0 && (
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                {studioAssets.map((asset) => (
                  <button
                    key={asset.id}
                    type="button"
                    title={asset.displayName}
                    className="rounded-lg border border-chanv-terre/15 bg-white p-1 text-left hover:border-chanv-terre/40 disabled:opacity-50"
                    disabled={uploading !== null}
                    onClick={() => void pickStudioAsset(asset)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={asset.thumbUrl}
                      alt={asset.displayName}
                      loading="lazy"
                      className="h-20 w-full rounded object-contain"
                    />
                    <span className="mt-1 block truncate text-[11px] text-chanv-terre/70">
                      {asset.displayName}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      <section className="card p-6 space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-chanv-terre/60">Identifiants</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label">SKU</label>
            <input className="input" maxLength={64} value={f.sku} onChange={(e) => update("sku", e.target.value)} />
          </div>
          <div>
            <label className="label">GTIN</label>
            <input className="input" value={f.gtin} onChange={(e) => update("gtin", e.target.value)} placeholder="8 à 14 chiffres" />
          </div>
          <div>
            <label className="label">Notes internes</label>
            <input className="input" value={f.sourceNotes} onChange={(e) => update("sourceNotes", e.target.value)} />
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? "Enregistrement…" : submitLabel}
        </button>
        {onCancel && (
          <button type="button" className="btn-secondary" onClick={onCancel} disabled={saving}>
            Annuler
          </button>
        )}
      </div>
    </form>
  );
}

function detailLabel(field: string): string {
  switch (field) {
    case "format":
      return "Format";
    case "variety":
      return "Variété";
    case "effects":
      return "Effets";
    case "terpenes":
      return "Terpènes";
    case "growLocation":
      return "Lieu de culture";
    case "distribution":
      return "Distribution";
    default:
      return field;
  }
}
