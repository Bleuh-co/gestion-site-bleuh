"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type {
  Localized,
  LocalizedNullable,
  ProductDetails,
  ProductImages,
  ProductProvince,
  ProductStatus,
  ProductStrain,
} from "@/lib/types";

// Aperçu « tel que le visiteur le verra » d'une fiche produit, AVANT publication.
//
// Le rendu reproduit celui du storefront site-bleuh
// (src/components/products/ProductDetailPage.tsx) : même ordre de blocs, mêmes
// libellés FR/EN, mêmes règles de composition (pastilles, choix du lien
// d'achat selon la région). Il est volontairement rendu ICI, à partir de
// l'état du formulaire, et non par un appel au site public : un produit en
// brouillon est filtré côté catalogue (`where("status","==","published")`), il
// n'a donc aucune URL publique tant qu'il n'est pas publié.
//
// Contrepartie assumée : c'est une COPIE de la mise en page publique. Les
// blocs qui dépendent de données vivantes ou d'autres documents (variétés en
// rotation, produits suggérés, disponibilités en magasin) ne sont pas
// reproduits — le pied de l'aperçu le dit au lieu de le laisser croire.
//
// Si le storefront change l'ordre des blocs ou ses libellés, ce fichier doit
// suivre : c'est le prix d'un aperçu qui ne dépend pas du site public.

/**
 * Ce que l'aperçu a besoin de connaître d'un produit.
 *
 * Sous-ensemble commun à `Product` (fiche enregistrée) et `ProductFormInput`
 * (saisie en cours, non enregistrée) : les deux sont acceptés tels quels.
 * `currentRotation` est optionnel parce que le formulaire ne l'édite pas.
 */
export interface PreviewProduct {
  name: Localized;
  collection: string;
  strain: ProductStrain;
  weight: string;
  thc: string;
  cbd: string;
  provinces: ProductProvince[];
  description: Localized;
  details: ProductDetails;
  images: ProductImages;
  buyLink: LocalizedNullable | null;
  ocsLink: string | null;
  gtin: string | null;
  currentRotation?: LocalizedNullable | null;
  status: ProductStatus;
}

type Locale = "fr" | "en";
type Region = "qc" | "on";

// Couleur des pastilles, alignée sur STRAIN_COLORS du storefront.
const STRAIN_COLORS: Record<string, string> = {
  sativa: "#ffd100",
  indica: "#f095cd",
  hybrid: "#ff8300",
};

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function buildPills(product: PreviewProduct, locale: Locale): string[] {
  // Bleuh Clair est une gamme CBD : le CBD y passe devant le THC (même
  // arbitrage que le storefront).
  const rates =
    product.collection === "bleuh-light" ? [product.cbd, product.thc] : [product.thc, product.cbd];
  // Le storefront présente l'Ontario sous le nom « Canada ».
  const provinceLabels = (product.provinces ?? []).map((p) => (p === "on" ? "Canada" : "Québec"));
  return [
    product.strain ? cap(product.strain) : "",
    ...rates,
    product.weight,
    product.currentRotation?.[locale] ? "Rotation" : "",
    ...provinceLabels,
  ]
    .map((v) => (v ?? "").trim())
    .filter(Boolean);
}

function buildBuyUrl(product: PreviewProduct, locale: Locale, region: Region): string | null {
  // Le détaillant dépend de la ZONE, jamais de la langue : SQDC au Québec, OCS
  // au Canada. La langue ne choisit que la variante du lien SQDC.
  const url =
    region === "qc"
      ? locale === "fr"
        ? product.buyLink?.fr || product.buyLink?.en
        : product.buyLink?.en || product.buyLink?.fr
      : product.ocsLink || product.buyLink?.en || product.buyLink?.fr;
  return url ? url.trim() || null : null;
}

function detailRows(product: PreviewProduct, locale: Locale): { label: string; value: string }[] {
  const isFr = locale === "fr";
  const d = product.details;
  return [
    { label: isFr ? "Format" : "Format", value: d?.format?.[locale] ?? "" },
    { label: isFr ? "Variété" : "Variety", value: d?.variety?.[locale] ?? "" },
    { label: isFr ? "Effets potentiels" : "Potential effects", value: d?.effects?.[locale] ?? "" },
    { label: isFr ? "Terpènes" : "Terpenes", value: d?.terpenes?.[locale] ?? "" },
    { label: isFr ? "Lieu de culture" : "Grow location", value: d?.growLocation?.[locale] ?? "" },
    { label: "Distribution", value: d?.distribution?.[locale] ?? "" },
  ]
    .map((r) => ({ ...r, value: (r.value ?? "").trim() }))
    .filter((r) => r.value);
}

interface ProductPreviewProps {
  product: PreviewProduct;
  onClose: () => void;
}

export function ProductPreview({ product, onClose }: ProductPreviewProps) {
  const [locale, setLocale] = useState<Locale>("fr");
  const [region, setRegion] = useState<Region>("qc");
  const [mounted, setMounted] = useState(false);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => setMounted(true), []);

  // Fermeture au clavier + blocage du défilement de la page derrière l'aperçu.
  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [handleKey]);

  if (!mounted) return null;

  const isFr = locale === "fr";
  const mainImage = (product.images?.gallery?.[0] || product.images?.main || "").trim();
  const title = (product.name?.[locale] ?? "").trim();
  const description = (product.description?.[locale] ?? "").trim();
  const pills = buildPills(product, locale);
  const buyUrl = buildBuyUrl(product, locale, region);
  const rows = detailRows(product, locale);
  const strainColor = STRAIN_COLORS[product.strain] ?? "#ff8300";
  const rotationNote = (product.currentRotation?.[locale] ?? "").trim();

  return createPortal(
    <div
      className="pp-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="pp-modal" role="dialog" aria-modal="true" aria-label="Aperçu de la fiche produit">
        <div className="pp-bar">
          <div className="pp-bar-title">
            <strong>Aperçu de la fiche</strong>
            <span className="pp-bar-sub">telle qu&apos;elle apparaîtra sur bleuh.co</span>
          </div>

          <div className="pp-bar-controls">
            <div className="pp-toggle" role="group" aria-label="Langue de l'aperçu">
              <button
                type="button"
                className={locale === "fr" ? "pp-toggle-btn pp-toggle-active" : "pp-toggle-btn"}
                onClick={() => setLocale("fr")}
                aria-pressed={locale === "fr"}
              >
                Français
              </button>
              <button
                type="button"
                className={locale === "en" ? "pp-toggle-btn pp-toggle-active" : "pp-toggle-btn"}
                onClick={() => setLocale("en")}
                aria-pressed={locale === "en"}
              >
                English
              </button>
            </div>

            <div className="pp-toggle" role="group" aria-label="Région de l'aperçu">
              <button
                type="button"
                className={region === "qc" ? "pp-toggle-btn pp-toggle-active" : "pp-toggle-btn"}
                onClick={() => setRegion("qc")}
                aria-pressed={region === "qc"}
              >
                Québec
              </button>
              <button
                type="button"
                className={region === "on" ? "pp-toggle-btn pp-toggle-active" : "pp-toggle-btn"}
                onClick={() => setRegion("on")}
                aria-pressed={region === "on"}
              >
                Canada
              </button>
            </div>

            <button ref={closeRef} type="button" className="pp-close" onClick={onClose} aria-label="Fermer l'aperçu">
              Fermer
            </button>
          </div>
        </div>

        {product.status !== "published" && (
          <p className="pp-status">
            {product.status === "archived"
              ? "Ce produit est archivé : il n'apparaît pas sur le site. Voici la fiche telle qu'elle serait publiée."
              : "Ce produit est en brouillon : il n'est pas encore visible sur le site. Voici la fiche telle qu'elle sera publiée."}
          </p>
        )}

        <div className="pp-scroll">
          {/* Rendu aux couleurs du site public : il ne suit pas le thème sombre
              de la console, sinon l'aperçu mentirait sur le résultat final. */}
          <div className="pp-canvas">
            <div className="pp-top">
              <div className="pp-image-col">
                {mainImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={mainImage} alt={title} className="pp-image" />
                ) : (
                  <div className="pp-image-empty">Aucune image : le visiteur ne verra pas de visuel.</div>
                )}
              </div>

              <div className="pp-info">
                <h1 className="pp-title">
                  {title || <span className="pp-missing">(nom manquant en {isFr ? "français" : "anglais"})</span>}
                </h1>

                {pills.length > 0 && (
                  <div className="pp-pills">
                    {pills.map((label, i) => (
                      <span key={`${i}-${label}`} className="pp-pill" style={{ backgroundColor: strainColor }}>
                        {label}
                      </span>
                    ))}
                  </div>
                )}

                {rotationNote && <p className="pp-rotation">{rotationNote}</p>}

                {description ? (
                  <div className="pp-desc">
                    {description
                      .split("\n")
                      .filter(Boolean)
                      .map((para, i) => (
                        <p key={i}>{para}</p>
                      ))}
                  </div>
                ) : (
                  <p className="pp-missing">(description manquante en {isFr ? "français" : "anglais"})</p>
                )}

                <div className="pp-actions">
                  <span className="pp-btn-avail">{isFr ? "Voir les disponibilités" : "See availability"}</span>
                  {buyUrl ? (
                    <span className="pp-btn-buy">{isFr ? "Acheter le produit" : "Buy the product"}</span>
                  ) : (
                    <span className="pp-missing">
                      {region === "qc"
                        ? "(pas de lien d'achat : le bouton « Acheter le produit » n'apparaîtra pas)"
                        : "(pas de lien OCS : le bouton « Acheter le produit » n'apparaîtra pas au Canada)"}
                    </span>
                  )}
                </div>
                {buyUrl && <p className="pp-buy-url">{buyUrl}</p>}
              </div>
            </div>

            {rows.length > 0 && (
              <section className="pp-details">
                <h2 className="pp-details-title">{isFr ? "Détails" : "Details"}</h2>
                <dl className="pp-details-list">
                  {rows.map((row) => (
                    <div key={row.label} className="pp-detail-row">
                      <dt>{row.label}</dt>
                      <dd>{row.value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}
          </div>
        </div>

        <p className="pp-note">
          Aperçu indicatif : les variétés en rotation, les produits suggérés et les disponibilités en magasin sont
          ajoutés par le site au moment de l&apos;affichage et ne sont pas reproduits ici. Rien n&apos;est enregistré
          tant que vous n&apos;avez pas cliqué sur Enregistrer.
        </p>
      </div>
    </div>,
    document.body
  );
}
