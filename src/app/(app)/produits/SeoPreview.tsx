"use client";

import { useT } from "@/lib/i18n";
import type { Localized } from "@/lib/types";

// Aperçu du référencement d'une fiche produit : le résultat de recherche
// Google, et la carte de partage (Facebook / LinkedIn / Messenger).
//
// Même principe que ProductPreview : le rendu est une COPIE de ce que fera le
// site public, calculée depuis la saisie en cours. La règle qui gouverne tout
// ce fichier tient en une phrase : un champ vide doit afficher CE QUE LE SITE
// AFFICHERA, pas du vide. Un aperçu qui montre une ligne blanche là où le
// visiteur verra « Blue Dream - Bleuh » ne prévisualise rien — il laisse
// croire qu'il y a un trou à boucher alors que le défaut est déjà bon.
//
// Ce qu'il ne prétend PAS reproduire, et pourquoi c'est dit à l'écran :
//   - la coupure exacte des textes trop longs (Google coupe au pixel, pas au
//     caractère, et pas au même endroit selon l'appareil) — d'où le
//     line-clamp, qui montre QU'ÇA coupe sans mentir sur OÙ ;
//   - la description elle-même, que Google réécrit très souvent.

/** Repères usuels, pas des maximums : rien n'est bloqué au-delà. */
export const SEO_TITLE_LIMIT = 60;
export const SEO_DESCRIPTION_LIMIT = 155;

const SITE_BASE = "https://bleuh.co";

/**
 * Le titre que le site compose quand `seoTitle` est vide.
 *
 * Doit rester aligné sur site-bleuh : c'est là-bas que « <nom> - Bleuh » est
 * écrit en dur. Si le storefront change sa formule, cette fonction suit —
 * sinon l'aperçu annonce un titre que Google n'affichera pas.
 */
export function defaultSeoTitle(productName: string): string {
  const name = productName.trim();
  return name ? `${name} - Bleuh` : "";
}

/**
 * L'adresse publique de la fiche, telle que site-bleuh la construit :
 * `/[locale]/produit/[slug]` en français, `/[locale]/product/[slug]` en
 * anglais (cf. l'arborescence src/app/[locale] du storefront).
 */
export function publicProductUrl(lang: "fr" | "en", slug: string): string {
  const segment = lang === "fr" ? "produit" : "product";
  return `${SITE_BASE}/${lang}/${segment}/${slug.trim()}`;
}

/** `https://bleuh.co/fr/produit/x` → `bleuh.co › fr › produit › x`. */
function breadcrumb(url: string): string {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean).map((p) => {
      try {
        return decodeURIComponent(p);
      } catch {
        return p;
      }
    });
    return [u.host, ...parts].join(" › ");
  } catch {
    // Adresse canonique encore incomplète pendant la frappe : on montre ce
    // qui est tapé plutôt que de masquer la ligne.
    return url;
  }
}

/** true si la chaîne est une URL absolue exploitable. Vide → pas d'erreur. */
export function isUsableUrl(value: string): boolean {
  const v = value.trim();
  if (!v) return true;
  try {
    const u = new URL(v);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * Compteur de caractères. Avertit, ne bloque jamais, et ne s'affiche pas en
 * rouge : dépasser n'est pas une faute, c'est un arbitrage (un titre long et
 * juste vaut mieux qu'un titre court et faux).
 */
export function CharCount({ value, max }: { value: string; max: number }) {
  const t = useT();
  const n = value.trim().length;
  const over = n > max;
  return (
    <p className={`mt-1 text-xs ${over ? "text-amber-700" : "text-chanv-terre/50"}`}>
      {t("produits.seo.chars", { n, max })}
      {over && <> — {t("produits.seo.charsOver", { max })}</>}
    </p>
  );
}

interface GoogleResultProps {
  lang: "fr" | "en";
  productName: string;
  slug: string;
  seoTitle: string;
  metaDescription: string;
  canonical: string;
  noindex: boolean;
}

function GoogleResult({
  lang,
  productName,
  slug,
  seoTitle,
  metaDescription,
  canonical,
  noindex,
}: GoogleResultProps) {
  const t = useT();

  const fallbackTitle = defaultSeoTitle(productName);
  const title = seoTitle.trim() || fallbackTitle;
  const titleIsDefault = !seoTitle.trim();

  // L'adresse canonique, quand elle est renseignée, EST celle que Google
  // retient : l'aperçu doit la montrer, sinon il affiche une page que le
  // moteur ne référencera pas.
  const url = canonical.trim() || publicProductUrl(lang, slug);
  const urlIsCanonical = Boolean(canonical.trim());

  const description = metaDescription.trim();

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-wide text-chanv-terre/50">{lang}</span>
        {urlIsCanonical && (
          <span className="rounded-full bg-chanv-terre/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-chanv-terre/60">
            canonical
          </span>
        )}
      </div>

      {noindex && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {t("produits.seo.noindex.active")}
        </p>
      )}

      {/* bg-white explicite : les couleurs ci-dessous sont celles de Google,
          elles ne se relisent pas sur le fond sombre du thème Gandalf. */}
      <div
        className={`rounded-xl border border-chanv-terre/15 bg-white p-4 ${
          noindex ? "opacity-45 grayscale" : ""
        }`}
      >
        <p className="truncate text-xs text-[#006621]">{breadcrumb(url)}</p>
        <p className="mt-1 line-clamp-1 text-lg leading-snug text-[#1a0dab]">
          {title || <span className="text-[#70757a]">{t("produits.seo.untitled")}</span>}
        </p>
        {description ? (
          <p className="mt-1 line-clamp-2 text-sm leading-snug text-[#4d5156]">{description}</p>
        ) : (
          <p className="mt-1 text-sm italic leading-snug text-[#70757a]">
            {t("produits.seo.emptyDescription")}
          </p>
        )}
      </div>

      {titleIsDefault && fallbackTitle && (
        <p className="text-xs text-chanv-terre/50">↑ {t("produits.seo.default")}</p>
      )}
    </div>
  );
}

export interface SeoPreviewProps {
  name: Localized;
  /** Le slug tel que le serveur le retiendra, replis déjà appliqués. */
  slug: Localized;
  seoTitle: Localized;
  metaDescription: Localized;
  canonical: Localized;
  noindex: boolean;
}

/** Les deux résultats de recherche, FR et EN, côte à côte. */
export function SeoPreview({
  name,
  slug,
  seoTitle,
  metaDescription,
  canonical,
  noindex,
}: SeoPreviewProps) {
  const t = useT();
  return (
    <div className="space-y-3 rounded-xl border border-chanv-terre/15 bg-white/60 p-4">
      <h3 className="text-sm font-bold uppercase tracking-wide text-chanv-terre/60">
        {t("produits.seo.preview")}
      </h3>
      <div className="grid gap-4 sm:grid-cols-2">
        {(["fr", "en"] as const).map((lang) => (
          <GoogleResult
            key={lang}
            lang={lang}
            productName={name[lang]}
            slug={slug[lang]}
            seoTitle={seoTitle[lang]}
            metaDescription={metaDescription[lang]}
            canonical={canonical[lang]}
            noindex={noindex}
          />
        ))}
      </div>
      <p className="text-xs text-chanv-terre/50">{t("produits.seo.previewHint")}</p>
    </div>
  );
}

export interface ShareCardPreviewProps {
  /** Ce qui est saisi dans « Image de partage ». Peut être vide. */
  ogImage: string;
  /** Repli du site quand ogImage est vide — jamais enregistré à sa place. */
  imagesMain: string;
  title: string;
  url: string;
}

/** La carte telle qu'elle paraît dans un partage Facebook / Messenger. */
export function ShareCardPreview({ ogImage, imagesMain, title, url }: ShareCardPreviewProps) {
  const t = useT();
  const effective = ogImage.trim() || imagesMain.trim();
  const usingMain = !ogImage.trim() && Boolean(imagesMain.trim());

  let host = "bleuh.co";
  try {
    host = new URL(url).host;
  } catch {
    /* adresse incomplète pendant la frappe — le domaine par défaut suffit */
  }

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-bold uppercase tracking-wide text-chanv-terre/50">
        {t("produits.seo.og.preview")}
      </h4>
      <div className="max-w-sm overflow-hidden rounded-xl border border-chanv-terre/15 bg-white">
        {effective ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={effective}
            alt=""
            className="h-40 w-full bg-chanv-terre/5 object-cover"
          />
        ) : (
          <div className="flex h-40 w-full items-center justify-center bg-chanv-terre/5 px-4 text-center text-xs text-chanv-terre/50">
            {t("produits.seo.og.none")}
          </div>
        )}
        <div className="border-t border-chanv-terre/10 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-chanv-terre/40">{host}</p>
          <p className="line-clamp-2 text-sm font-semibold text-chanv-terre/80">{title}</p>
        </div>
      </div>
      {usingMain && <p className="text-xs text-chanv-terre/50">{t("produits.seo.og.usingMain")}</p>}
    </div>
  );
}
