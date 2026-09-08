"use client";

import { useMemo, useState } from "react";
import type {
  Product,
  ProductFormInput,
  ProductProvince,
  ProductRotationVariety,
  ProductStatus,
  ProductStrain,
} from "@/lib/types";
import {
  KNOWN_COLLECTIONS,
  PROVINCE_LABELS,
  ROTATION_CATEGORY_SUGGESTIONS,
  STATUS_LABELS,
  STRAIN_LABELS,
} from "./constants";
import { ProductPreview } from "./ProductPreview";

// Formulaire de création/édition produit — champs du vrai schéma
// (validateProductInput), porté depuis le formulaire admin
// Formulaire DB-Products-Master/public/site-products.js.
//
// Champs volontairement hors formulaire (édition avancée future, pas dans
// le brief cœur) : badges, relatedProducts, currentRotation, wpPostId, url.
//
// ATTENTION — ils doivent rester ABSENTS du payload, pas envoyés à vide.
// buildInput les émettait avec [] / null : à chaque « Enregistrer », le
// produit perdait ses badges, ses produits liés et son wpPostId. La route
// PATCH fusionne `{ ...doc.data(), ...body }`, donc une clé présente écrase
// toujours l'existant — même vide. Le type ProductFormInput (lib/types.ts)
// matérialise cette omission côté compilateur pour que la régression ne
// puisse pas revenir en silence.
//
// `rotationVarieties` était dans cette liste jusqu'au ticket
// 3Xk5sjItspoDLkitnGrM : le bloc « Nos variétés en rotation » de la fiche
// publique n'était éditable nulle part dans la console. Il l'est désormais
// ici, donc la clé EST émise — et une liste vidée exprès doit bien vider le
// bloc. Les deux vont ensemble : le champ dans le formulaire ET la clé dans
// buildInput, jamais l'un sans l'autre.

// Emplacement d'une image dans le produit : la vignette principale, la
// galerie, ou la vignette d'une variété en rotation (`variety:<index>`).
type ImageTarget = "main" | "gallery" | `variety:${number}`;

function varietyTargetIndex(target: ImageTarget): number | null {
  if (!target.startsWith("variety:")) return null;
  const i = Number(target.slice("variety:".length));
  return Number.isInteger(i) && i >= 0 ? i : null;
}

/**
 * Une ligne du bloc « variétés en rotation » telle que le formulaire la
 * manipule : tout en chaînes, pas d'`undefined`, pour que les champs soient
 * des inputs contrôlés. `badgeImage` n'a pas de champ — c'est un visuel hérité
 * de WordPress qu'on transporte tel quel, mais dont la présence suffit au site
 * à afficher la pastille « Nouvelle variété ». La case à cocher doit donc le
 * piloter aussi, sinon décocher ne changerait rien à l'écran du visiteur.
 */
interface RotationVarietyRow {
  name: string;
  category: string;
  thc: string;
  url: string;
  image: string;
  isNew: boolean;
  badgeImage: string | null;
}

function toRotationRows(list?: ProductRotationVariety[] | null): RotationVarietyRow[] {
  return (list ?? []).map((v) => ({
    name: v.name ?? "",
    category: v.category ?? "",
    thc: v.thc ?? "",
    url: v.url ?? "",
    image: v.image ?? "",
    // Le site fait `isNewVariety || Boolean(badgeImage)` : la case reflète ce
    // que le visiteur voit réellement, pas seulement le booléen.
    isNew: Boolean(v.isNewVariety) || Boolean(v.badgeImage),
    badgeImage: v.badgeImage ?? null,
  }));
}

function fromRotationRows(rows: RotationVarietyRow[]): ProductRotationVariety[] {
  return rows
    .map((r) => ({ ...r, name: r.name.trim() }))
    .filter((r) => r.name)
    .map((r) => ({
      name: r.name,
      url: r.url.trim(),
      category: r.category.trim(),
      thc: r.thc.trim(),
      image: r.image.trim(),
      isNewVariety: r.isNew,
      // Décocher retire aussi le badge hérité, sinon la pastille resterait
      // affichée sur le site et la case mentirait.
      badgeImage: r.isNew ? r.badgeImage : null,
    }));
}

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
    rotationVarieties: toRotationRows(p?.rotationVarieties),
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
    rotationVarieties: fromRotationRows(f.rotationVarieties),
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
  // Aperçu avant publication : rendu à partir de la saisie EN COURS, sans
  // enregistrer. On repasse par buildInput pour que l'aperçu montre exactement
  // ce qui partirait à l'API (valeurs rognées, tags découpés, galerie éclatée).
  const [previewing, setPreviewing] = useState(false);

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

  // ── Variétés en rotation ─────────────────────────────────────────────
  // Liste ORDONNÉE : le site affiche les cartes dans cet ordre, d'où les
  // boutons monter/descendre plutôt qu'un tri automatique.

  function updateVariety<K extends keyof RotationVarietyRow>(
    index: number,
    key: K,
    value: RotationVarietyRow[K]
  ) {
    setF((prev) => ({
      ...prev,
      rotationVarieties: prev.rotationVarieties.map((row, i) =>
        i === index ? { ...row, [key]: value } : row
      ),
    }));
  }

  function addVariety() {
    setF((prev) => ({
      ...prev,
      rotationVarieties: [
        ...prev.rotationVarieties,
        { name: "", category: "", thc: "", url: "", image: "", isNew: false, badgeImage: null },
      ],
    }));
  }

  function removeVariety(index: number) {
    setF((prev) => ({
      ...prev,
      rotationVarieties: prev.rotationVarieties.filter((_, i) => i !== index),
    }));
  }

  function moveVariety(index: number, delta: number) {
    setF((prev) => {
      const next = [...prev.rotationVarieties];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return { ...prev, rotationVarieties: next };
    });
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
      const varietyIndex = varietyTargetIndex(target);
      if (varietyIndex !== null) {
        if (varietyIndex >= prev.rotationVarieties.length) return prev;
        return {
          ...prev,
          rotationVarieties: prev.rotationVarieties.map((row, i) =>
            i === varietyIndex ? { ...row, image: url } : row
          ),
        };
      }
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
      // L'image d'une variété est classée dans Studio Chanv sous le nom de la
      // variété (« Candy Kush »), pas sous celui du produit : c'est ce nom-là
      // qu'on cherchera pour la retrouver.
      const varietyIndex = varietyTargetIndex(target);
      const assetName =
        varietyIndex !== null
          ? f.rotationVarieties[varietyIndex]?.name.trim() || f.name.fr.trim()
          : f.name.fr.trim();
      if (assetName) fd.append("productName", assetName);
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

  // Le sélecteur Studio Chanv est partagé par les images du produit et
  // celles des variétés en rotation. Il est rendu DANS la section qui a
  // demandé l'image (`studioTarget`), pas à un endroit fixe : sinon,
  // cliquer « Choisir dans Studio Chanv » sur la 4e variété ferait
  // apparaître la grille dans une autre carte, plus haut dans la page.
  function studioPicker() {
    if (!studioTarget) return null;
    return (
          <div className="space-y-3 rounded-xl border border-chanv-terre/15 bg-white/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold uppercase tracking-wide text-chanv-terre/60">
                Studio Chanv — images Bleuh
                {studioTargetLabel(studioTarget)}
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

        {studioTarget && varietyTargetIndex(studioTarget) === null && studioPicker()}
      </section>

      <section className="card p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-chanv-terre/60">
            Variétés en rotation
          </h2>
          <button type="button" className="btn-secondary" onClick={addVariety} disabled={saving}>
            Ajouter une variété
          </button>
        </div>
        <p className="text-sm text-chanv-terre/60">
          Ce sont les vignettes du bloc «&nbsp;Nos variétés en rotation&nbsp;» au bas de la fiche
          produit sur bleuh.co. Elles appartiennent à ce produit : les modifier ici ne change ni le
          référentiel des variétés, ni les autres produits. L&apos;ordre des cartes est celui de
          cette liste.
        </p>

        {imageError && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {imageError}
          </p>
        )}

        {f.rotationVarieties.length === 0 ? (
          <p className="text-sm text-chanv-terre/50">
            Aucune variété en rotation : le bloc n&apos;apparaîtra pas sur la fiche publique.
          </p>
        ) : (
          <ul className="space-y-4">
            {f.rotationVarieties.map((row, i) => (
              <li key={i} className="rounded-xl border border-chanv-terre/15 bg-white/60 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wide text-chanv-terre/50">
                    Variété n° {i + 1}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="btn-secondary"
                      aria-label={`Monter la variété n° ${i + 1}`}
                      disabled={saving || i === 0}
                      onClick={() => moveVariety(i, -1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      aria-label={`Descendre la variété n° ${i + 1}`}
                      disabled={saving || i === f.rotationVarieties.length - 1}
                      onClick={() => moveVariety(i, 1)}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={saving}
                      onClick={() => removeVariety(i)}
                    >
                      Retirer
                    </button>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="label label-required">Nom de la variété</label>
                    <input
                      className="input"
                      value={row.name}
                      placeholder="ex. Candy Kush"
                      onChange={(e) => updateVariety(i, "name", e.target.value)}
                    />
                    {!row.name.trim() && (
                      <p className="mt-1 text-xs text-amber-700">
                        Sans nom, cette variété ne sera pas enregistrée.
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="label">Catégorie</label>
                    <input
                      className="input"
                      list="rotation-category-suggestions"
                      value={row.category}
                      placeholder="ex. Hybride à dominance indica"
                      onChange={(e) => updateVariety(i, "category", e.target.value)}
                    />
                    <p className="mt-1 text-xs text-chanv-terre/50">
                      Texte libre, affiché tel quel sous le nom de la variété.
                    </p>
                  </div>
                  <div>
                    <label className="label">THC (étiquette)</label>
                    <input
                      className="input"
                      value={row.thc}
                      placeholder="ex. THC:25%-30%"
                      onChange={(e) => updateVariety(i, "thc", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">Lien vers la fiche variété</label>
                    <input
                      className="input"
                      value={row.url}
                      placeholder="laisser vide si la carte ne doit pas être cliquable"
                      onChange={(e) => updateVariety(i, "url", e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="label">Image de la variété</label>
                  {row.image ? (
                    <div className="flex items-start gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={row.image}
                        alt={`Aperçu de la variété ${row.name || i + 1}`}
                        className="h-24 w-24 rounded-lg border border-chanv-terre/15 bg-white object-contain"
                      />
                      <button
                        type="button"
                        className="btn-secondary"
                        disabled={saving || uploading !== null}
                        onClick={() => updateVariety(i, "image", "")}
                      >
                        Retirer
                      </button>
                    </div>
                  ) : (
                    <p className="text-sm text-chanv-terre/50">Aucune image pour cette variété.</p>
                  )}
                  {imageActions(`variety:${i}`)}
                  <input
                    className="input"
                    value={row.image}
                    placeholder="…ou coller une adresse d'image"
                    onChange={(e) => updateVariety(i, "image", e.target.value)}
                  />
                </div>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={row.isNew}
                    onChange={(e) => updateVariety(i, "isNew", e.target.checked)}
                  />
                  Afficher la pastille «&nbsp;Nouvelle variété&nbsp;»
                </label>

                {studioTarget === `variety:${i}` && studioPicker()}
              </li>
            ))}
          </ul>
        )}

        <datalist id="rotation-category-suggestions">
          {ROTATION_CATEGORY_SUGGESTIONS.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
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
        {/* type="button" : sans lui, un bouton dans un <form> soumet le
            formulaire — ici il ouvrirait l'aperçu ET enregistrerait. */}
        <button type="button" className="btn-secondary" onClick={() => setPreviewing(true)} disabled={saving}>
          Prévisualiser
        </button>
        {onCancel && (
          <button type="button" className="btn-secondary" onClick={onCancel} disabled={saving}>
            Annuler
          </button>
        )}
        <span className="text-xs text-chanv-terre/60">
          L&apos;aperçu n&apos;enregistre rien et ne publie rien.
        </span>
      </div>

      {previewing && <ProductPreview product={buildInput(f)} onClose={() => setPreviewing(false)} />}
    </form>
  );
}

function studioTargetLabel(target: ImageTarget): string {
  if (target === "main") return " (image principale)";
  if (target === "gallery") return " (galerie)";
  const index = varietyTargetIndex(target);
  return index === null ? "" : ` (variété n° ${index + 1})`;
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
