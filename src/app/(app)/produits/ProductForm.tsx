"use client";

import { useMemo, useState } from "react";
import type { Product, ProductInput, ProductProvince, ProductStatus, ProductStrain } from "@/lib/types";
import { KNOWN_COLLECTIONS, PROVINCE_LABELS, STATUS_LABELS, STRAIN_LABELS } from "./constants";
import { useT } from "@/lib/i18n";

// Formulaire de création/édition produit — champs du vrai schéma
// (validateProductInput), porté depuis le formulaire admin
// Formulaire DB-Products-Master/public/site-products.js.
//
// Champs volontairement hors formulaire (édition avancée future, pas dans
// le brief cœur) : badges, rotationVarieties, relatedProducts,
// currentRotation, wpPostId, url — l'API les défaut à [] / null si absents.

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

function buildInput(f: ProductFormState): ProductInput {
  const collection = f.collection === "__other__" ? f.collectionCustom.trim() : f.collection;
  return {
    wpPostId: null,
    slug: { fr: f.slug.fr.trim(), en: f.slug.en.trim() },
    url: null,
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
    provinces: f.provinces,
    isNew: f.isNew,
    isWebOnly: f.isWebOnly,
    isComingSoon: f.isComingSoon,
    currentRotation: null,
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
    badges: [],
    buyLink:
      f.buyLink.fr || f.buyLink.en ? { fr: f.buyLink.fr || null, en: f.buyLink.en || null } : null,
    ocsLink: f.ocsLink.trim() || null,
    gtin: f.gtin.trim() || null,
    sku: f.sku.trim() || null,
    rotationVarieties: [],
    relatedProducts: [],
    sourceNotes: f.sourceNotes.trim() || null,
    status: f.status,
  };
}

interface ProductFormProps {
  initial?: Product | null;
  submitLabel: string;
  saving: boolean;
  error?: string | null;
  onSubmit: (input: ProductInput) => void | Promise<void>;
  onCancel?: () => void;
}

export function ProductForm({ initial, submitLabel, saving, error, onSubmit, onCancel }: ProductFormProps) {
  const t = useT();
  const [f, setF] = useState<ProductFormState>(() => toFormState(initial));

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

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      )}

      <section className="card p-6 space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-chanv-terre/60">{t("produits.identity")}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label label-required">{t("produits.nameFr")}</label>
            <input
              className="input"
              required
              value={f.name.fr}
              onChange={(e) => handleNameFrChange(e.target.value)}
            />
          </div>
          <div>
            <label className="label label-required">{t("produits.nameEn")}</label>
            <input
              className="input"
              required
              value={f.name.en}
              onChange={(e) => updateLocalized("name", "en", e.target.value)}
            />
          </div>
          <div>
            <label className="label">{t("produits.slugFr")}</label>
            <input className="input" value={f.slug.fr} onChange={(e) => updateLocalized("slug", "fr", e.target.value)} placeholder={t("produits.slugPlaceholder")} />
          </div>
          <div>
            <label className="label">{t("produits.slugEn")}</label>
            <input className="input" value={f.slug.en} onChange={(e) => updateLocalized("slug", "en", e.target.value)} placeholder={t("produits.slugPlaceholder")} />
          </div>
          <div>
            <label className="label label-required">{t("produits.collection")}</label>
            <select
              className="input"
              required
              value={collectionIsKnown ? f.collection : "__other__"}
              onChange={(e) => update("collection", e.target.value)}
            >
              <option value="">{t("produits.selectPlaceholder")}</option>
              {KNOWN_COLLECTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
              <option value="__other__">{t("produits.otherOption")}</option>
            </select>
            {!collectionIsKnown && (
              <input
                className="input mt-2"
                placeholder={t("produits.customCollectionPlaceholder")}
                value={f.collectionCustom}
                onChange={(e) => update("collectionCustom", e.target.value)}
              />
            )}
          </div>
          <div>
            <label className="label">{t("produits.brand")}</label>
            <input className="input" value={f.brand} onChange={(e) => update("brand", e.target.value)} />
          </div>
          <div>
            <label className="label">{t("produits.status")}</label>
            <select className="input" value={f.status} onChange={(e) => update("status", e.target.value as ProductStatus)}>
              {(Object.keys(STATUS_LABELS) as ProductStatus[]).map((s) => (
                <option key={s} value={s}>
                  {t("produits.status." + s)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">{t("produits.strainLabel")}</label>
            <select className="input" value={f.strain} onChange={(e) => update("strain", e.target.value as ProductStrain)}>
              {(Object.keys(STRAIN_LABELS) as ProductStrain[]).map((s) => (
                <option key={s} value={s}>
                  {t("produits.strain." + s)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="label label-required">{t("produits.provinces")}</label>
          <div className="flex gap-4">
            {(Object.keys(PROVINCE_LABELS) as ProductProvince[]).map((p) => (
              <label key={p} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={f.provinces.includes(p)} onChange={() => toggleProvince(p)} />
                {t("produits.province." + p)}
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.isNew} onChange={(e) => update("isNew", e.target.checked)} />
            {t("produits.flagNew")}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.isWebOnly} onChange={(e) => update("isWebOnly", e.target.checked)} />
            {t("produits.flagWebOnly")}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.isComingSoon} onChange={(e) => update("isComingSoon", e.target.checked)} />
            {t("produits.flagComingSoon")}
          </label>
        </div>

        <div>
          <label className="label">{t("produits.tagsLabel")}</label>
          <input className="input" value={f.tags} onChange={(e) => update("tags", e.target.value)} />
        </div>
      </section>

      <section className="card p-6 space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-chanv-terre/60">{t("produits.sectionFormatThc")}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="label">{t("produits.formatSlug")}</label>
            <input className="input" value={f.formatSlug} onChange={(e) => update("formatSlug", e.target.value)} />
          </div>
          <div>
            <label className="label">{t("produits.weight")}</label>
            <input className="input" value={f.weight} onChange={(e) => update("weight", e.target.value)} placeholder={t("produits.weightPlaceholder")} />
          </div>
          <div>
            <label className="label">{t("produits.thcLabel")}</label>
            <input className="input" value={f.thc} onChange={(e) => update("thc", e.target.value)} placeholder={t("produits.thcPlaceholder")} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">{t("produits.thcMin")}</label>
              <input
                type="number"
                step="0.01"
                className="input"
                value={f.thcMin ?? ""}
                onChange={(e) => update("thcMin", e.target.value === "" ? null : Number(e.target.value))}
              />
            </div>
            <div>
              <label className="label">{t("produits.thcMax")}</label>
              <input
                type="number"
                step="0.01"
                className="input"
                value={f.thcMax ?? ""}
                onChange={(e) => update("thcMax", e.target.value === "" ? null : Number(e.target.value))}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="card p-6 space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-chanv-terre/60">{t("produits.sectionDescriptions")}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">{t("produits.descriptionFr")}</label>
            <textarea className="input min-h-[6rem]" value={f.description.fr} onChange={(e) => updateLocalized("description", "fr", e.target.value)} />
          </div>
          <div>
            <label className="label">{t("produits.descriptionEn")}</label>
            <textarea className="input min-h-[6rem]" value={f.description.en} onChange={(e) => updateLocalized("description", "en", e.target.value)} />
          </div>
          <div>
            <label className="label">{t("produits.metaDescriptionFr")}</label>
            <textarea className="input min-h-[4rem]" value={f.metaDescription.fr} onChange={(e) => updateLocalized("metaDescription", "fr", e.target.value)} />
          </div>
          <div>
            <label className="label">{t("produits.metaDescriptionEn")}</label>
            <textarea className="input min-h-[4rem]" value={f.metaDescription.en} onChange={(e) => updateLocalized("metaDescription", "en", e.target.value)} />
          </div>
        </div>
      </section>

      <section className="card p-6 space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-chanv-terre/60">{t("produits.sectionDetails")}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {(Object.keys(f.details) as (keyof ProductFormState["details"])[]).map((field) => (
            <div key={field} className="grid grid-cols-2 gap-2">
              <div>
                <label className="label capitalize">{t("produits.detailField." + field)} (FR)</label>
                <input className="input" value={f.details[field].fr} onChange={(e) => updateDetail(field, "fr", e.target.value)} />
              </div>
              <div>
                <label className="label capitalize">{t("produits.detailField." + field)} (EN)</label>
                <input className="input" value={f.details[field].en} onChange={(e) => updateDetail(field, "en", e.target.value)} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card p-6 space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-chanv-terre/60">{t("produits.sectionImagesLinks")}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">{t("produits.imageMain")}</label>
            <input className="input" value={f.imagesMain} onChange={(e) => update("imagesMain", e.target.value)} />
          </div>
          <div>
            <label className="label">{t("produits.gallery")}</label>
            <input className="input" value={f.imagesGallery} onChange={(e) => update("imagesGallery", e.target.value)} />
          </div>
          <div>
            <label className="label">{t("produits.buyLinkFr")}</label>
            <input className="input" value={f.buyLink.fr ?? ""} onChange={(e) => update("buyLink", { ...f.buyLink, fr: e.target.value })} />
          </div>
          <div>
            <label className="label">{t("produits.buyLinkEn")}</label>
            <input className="input" value={f.buyLink.en ?? ""} onChange={(e) => update("buyLink", { ...f.buyLink, en: e.target.value })} />
          </div>
          <div>
            <label className="label">{t("produits.ocsLink")}</label>
            <input className="input" value={f.ocsLink} onChange={(e) => update("ocsLink", e.target.value)} />
          </div>
        </div>
      </section>

      <section className="card p-6 space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-chanv-terre/60">{t("produits.sectionIdentifiers")}</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label">SKU</label>
            <input className="input" maxLength={64} value={f.sku} onChange={(e) => update("sku", e.target.value)} />
          </div>
          <div>
            <label className="label">GTIN</label>
            <input className="input" value={f.gtin} onChange={(e) => update("gtin", e.target.value)} placeholder={t("produits.gtinPlaceholder")} />
          </div>
          <div>
            <label className="label">{t("produits.internalNotes")}</label>
            <input className="input" value={f.sourceNotes} onChange={(e) => update("sourceNotes", e.target.value)} />
          </div>
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? t("produits.saving") : submitLabel}
        </button>
        {onCancel && (
          <button type="button" className="btn-secondary" onClick={onCancel} disabled={saving}>
            {t("common.cancel")}
          </button>
        )}
      </div>
    </form>
  );
}
