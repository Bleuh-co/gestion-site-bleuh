import "server-only";
import { NextResponse } from "next/server";
import { adminDb } from "./firebase-admin";
import type { ApiError, Product, ProductInput, ProductProvince, ProductStatus, ProductStrain } from "./types";

// Modèle métier porté depuis Formulaire DB-Products-Master
// routes/site-products.js (validateProductInput, docToProduct, assertSkuUnique).
// Collection Firestore `products`, id de doc = slug.fr.

export const PRODUCTS_COLLECTION = "products";

const PRODUCT_STATUSES: ProductStatus[] = ["draft", "published", "archived"];
const PROVINCES: ProductProvince[] = ["qc", "on"];
const STRAINS: ProductStrain[] = ["indica", "sativa", "hybrid"];

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

// ──────────────────────────────────────────
// Helpers — normalisation (port fidèle du .js)
// ──────────────────────────────────────────

export function slugify(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function localizedOrEmpty(v: unknown): { fr: string; en: string } {
  const o = v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  return {
    fr: typeof o.fr === "string" ? o.fr : "",
    en: typeof o.en === "string" ? o.en : "",
  };
}

function asLocalizedNullable(v: unknown): { fr: string | null; en: string | null } | null {
  if (v == null || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const fr = typeof o.fr === "string" && o.fr.trim() ? o.fr : null;
  const en = typeof o.en === "string" && o.en.trim() ? o.en : null;
  if (fr === null && en === null) return null;
  return { fr, en };
}

function strOrNull(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v : null;
}

function numOrNull(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() && !Number.isNaN(Number(v))) return Number(v);
  return null;
}

function strArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

/**
 * Valide et normalise un payload produit (création ou remplacement complet).
 * Lance ValidationError avec un message explicite si invalide.
 */
export function validateProductInput(raw: unknown): ProductInput {
  if (!raw || typeof raw !== "object") {
    throw new ValidationError("Payload produit manquant ou invalide.");
  }
  const p = raw as Record<string, unknown>;

  const name = localizedOrEmpty(p.name);
  if (!name.fr.trim()) throw new ValidationError("Le nom FR est requis.");
  if (!name.en.trim()) throw new ValidationError("Le nom EN est requis.");

  const slugIn = localizedOrEmpty(p.slug);
  const slug = {
    fr: slugify(slugIn.fr.trim() || name.fr),
    en: slugify(slugIn.en.trim() || slugIn.fr.trim() || name.en),
  };
  if (!slug.fr) throw new ValidationError("Impossible de dériver un slug FR.");

  const status = (p.status as string) || "draft";
  if (!PRODUCT_STATUSES.includes(status as ProductStatus)) {
    throw new ValidationError(`Statut invalide: ${String(p.status)}.`);
  }

  const strain = (p.strain as string) || "hybrid";
  if (!STRAINS.includes(strain as ProductStrain)) {
    throw new ValidationError(`Catégorie (strain) invalide: ${String(p.strain)}.`);
  }

  const provincesRaw = Array.isArray(p.provinces)
    ? p.provinces
    : Array.isArray(p.province)
      ? p.province
      : [];
  const provinces = (provincesRaw as unknown[]).filter((x): x is ProductProvince =>
    PROVINCES.includes(x as ProductProvince)
  );
  if (provinces.length === 0) {
    throw new ValidationError("Au moins une province (qc/on) est requise.");
  }

  const collection = typeof p.collection === "string" ? p.collection.trim() : "";
  if (!collection) throw new ValidationError("La collection est requise.");

  const gtinRaw = typeof p.gtin === "string" ? p.gtin.trim() : "";
  if (gtinRaw && !/^\d{8,14}$/.test(gtinRaw)) {
    throw new ValidationError("GTIN invalide (8 à 14 chiffres attendus).");
  }

  const skuRaw = typeof p.sku === "string" ? p.sku.trim() : "";
  if (skuRaw && skuRaw.length > 64) {
    throw new ValidationError("SKU invalide (64 caractères max).");
  }

  const detailsRaw = p.details && typeof p.details === "object" ? (p.details as Record<string, unknown>) : {};
  const details = {
    format: localizedOrEmpty(detailsRaw.format),
    variety: localizedOrEmpty(detailsRaw.variety),
    effects: localizedOrEmpty(detailsRaw.effects),
    terpenes: localizedOrEmpty(detailsRaw.terpenes),
    growLocation: localizedOrEmpty(detailsRaw.growLocation),
    distribution: localizedOrEmpty(detailsRaw.distribution),
  };

  const imagesRaw = p.images && typeof p.images === "object" ? (p.images as Record<string, unknown>) : {};
  const images = {
    main: typeof imagesRaw.main === "string" ? imagesRaw.main : "",
    gallery: Array.isArray(imagesRaw.gallery)
      ? (imagesRaw.gallery as unknown[]).filter((x): x is string => typeof x === "string" && !!x)
      : [],
  };

  const badges = Array.isArray(p.badges)
    ? (p.badges as unknown[])
        .filter(
          (b): b is Record<string, unknown> =>
            !!b && typeof b === "object" && typeof (b as Record<string, unknown>).image === "string" && !!(b as Record<string, unknown>).image
        )
        .map((b) => ({ image: b.image as string, alt: typeof b.alt === "string" ? b.alt : "" }))
    : [];

  return {
    wpPostId: numOrNull(p.wpPostId),
    slug,
    url: asLocalizedNullable(p.url),
    name: { fr: name.fr.trim(), en: name.en.trim() },
    collection,
    brand: strOrNull(p.brand),
    strain: strain as ProductStrain,
    tags: strArray(p.tags),
    formatSlug: typeof p.formatSlug === "string" ? p.formatSlug : "",
    weight: typeof p.weight === "string" ? p.weight : "",
    thc: typeof p.thc === "string" ? p.thc : "",
    thcMin: numOrNull(p.thcMin),
    thcMax: numOrNull(p.thcMax),
    provinces,
    isNew: !!p.isNew,
    isWebOnly: !!p.isWebOnly,
    isComingSoon: !!p.isComingSoon,
    currentRotation: asLocalizedNullable(p.currentRotation),
    description: localizedOrEmpty(p.description),
    metaDescription: localizedOrEmpty(p.metaDescription),
    details,
    images,
    badges,
    buyLink: asLocalizedNullable(p.buyLink),
    ocsLink: strOrNull(p.ocsLink),
    gtin: gtinRaw || null,
    sku: skuRaw || null,
    rotationVarieties: Array.isArray(p.rotationVarieties) ? (p.rotationVarieties as unknown[]) : [],
    relatedProducts: Array.isArray(p.relatedProducts) ? (p.relatedProducts as unknown[]) : [],
    sourceNotes: strOrNull(p.sourceNotes),
    status: status as ProductStatus,
  };
}

// ──────────────────────────────────────────
// Helpers — Firestore
// ──────────────────────────────────────────

export function productsCol() {
  return adminDb().collection(PRODUCTS_COLLECTION);
}

export function docToProduct(doc: FirebaseFirestore.DocumentSnapshot): Product {
  return { ...(doc.data() as Omit<Product, "id">), id: doc.id };
}

/** Vérifie l'unicité du SKU parmi les produits Firestore. */
export async function assertSkuUnique(sku: string | null, excludeId?: string): Promise<void> {
  if (!sku) return;
  const snap = await productsCol().where("sku", "==", sku).limit(2).get();
  const other = snap.docs.find((d) => d.id !== excludeId);
  if (other) {
    throw new ValidationError(`Le SKU « ${sku} » est déjà lié au produit « ${other.id} ».`);
  }
}

/**
 * Convertit une erreur en réponse JSON typée (ApiError) avec le bon code HTTP.
 * ValidationError → 400 ; UNAUTHORIZED → 401 ; FORBIDDEN → 403 ; sinon 500.
 */
export function handleError(error: unknown, context: string): NextResponse<ApiError> {
  if (error instanceof ValidationError) {
    return NextResponse.json({ error: error.message, code: "validation_error" }, { status: 400 });
  }
  if (error instanceof Error && error.message === "UNAUTHORIZED") {
    return NextResponse.json({ error: "Non authentifié.", code: "unauthorized" }, { status: 401 });
  }
  if (error instanceof Error && error.message === "FORBIDDEN") {
    return NextResponse.json({ error: "Accès refusé.", code: "forbidden" }, { status: 403 });
  }
  console.error(`${context} :`, error);
  return NextResponse.json(
    { error: error instanceof Error ? error.message : "Erreur interne.", code: "internal_error" },
    { status: 500 }
  );
}
