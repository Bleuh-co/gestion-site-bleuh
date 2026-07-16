import "server-only";

/**
 * Extraction de signaux exploitables depuis le HTML brut d'une campagne
 * MailerLite, SANS renvoyer tout le HTML à l'IA (contrôle des tokens).
 *
 * On ne cherche pas à re-rendre l'email : on isole les quelques signaux qui
 * expliquent une sous-performance marketing (sujet/aperçu, texte lisible,
 * densité de liens/images, présence et emplacement d'un CTA, longueur).
 * Pur JS/regex — pas de dépendance DOM côté serveur.
 */

export interface HtmlCta {
  present: boolean;
  count: number;
  firstText: string | null;
  /** Position verticale approximative du 1er CTA dans le corps. */
  placement: "haut" | "milieu" | "bas" | null;
}

export interface HtmlSummary {
  title: string | null; // <title> de l'email, si présent
  preview: string | null; // preheader (texte d'aperçu masqué), si détecté
  wordCount: number;
  approxChars: number;
  linkCount: number;
  imageCount: number;
  /** Texte lisible, borné (~1500 mots) — jamais le HTML brut complet. */
  textExcerpt: string;
  cta: HtmlCta;
}

/** Verbes/formules d'action typiques d'un CTA (FR + quelques EN). */
const CTA_WORDS = [
  "acheter", "commander", "découvrir", "decouvrir", "voir", "magasiner",
  "en savoir plus", "profiter", "obtenir", "réserver", "reserver", "essayer",
  "télécharger", "telecharger", "s'inscrire", "inscrivez", "participer",
  "je découvre", "je decouvre", "shop", "buy", "learn more", "order", "view", "get",
];

const MAX_WORDS = 1500;

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&apos;/gi, "'")
    .replace(/&[a-z0-9#]+;/gi, " ");
}

/** HTML → texte lisible : retire style/script/commentaires/balises, normalise. */
function stripToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\s+/g, " ")
    .trim();
}

/** Preheader : élément masqué (display:none / font-size:0 …) souvent en tête. */
function findPreheader(html: string): string | null {
  const re =
    /<(div|span|p|td)[^>]*style=["'][^"']*(display\s*:\s*none|max-height\s*:\s*0|font-size\s*:\s*0(px)?|line-height\s*:\s*0|opacity\s*:\s*0)[^"']*["'][^>]*>([\s\S]*?)<\/\1>/i;
  const m = html.match(re);
  if (m) {
    const t = stripToText(m[5] || "").trim();
    if (t) return t.slice(0, 200);
  }
  return null;
}

/** Détecte un CTA (ancre stylée bouton ou libellé d'action) + son emplacement. */
function detectCta(html: string): HtmlCta {
  const anchorRe = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  const total = html.length || 1;
  let count = 0;
  let firstText: string | null = null;
  let firstIndex = -1;
  let m: RegExpExecArray | null;

  while ((m = anchorRe.exec(html)) !== null) {
    const attrs = m[1] || "";
    const inner = stripToText(m[2] || "");
    if (!inner) continue;
    const lc = inner.toLowerCase();
    const looksButton =
      /background(-color)?\s*:/i.test(attrs) ||
      /class\s*=\s*["'][^"']*(btn|button|cta)/i.test(attrs) ||
      /role\s*=\s*["']button/i.test(attrs);
    const actionWord = CTA_WORDS.some((w) => lc.includes(w));
    if (looksButton || actionWord) {
      count++;
      if (firstIndex < 0) {
        firstIndex = m.index;
        firstText = inner.slice(0, 80);
      }
    }
  }

  if (count === 0) return { present: false, count: 0, firstText: null, placement: null };
  const ratio = firstIndex / total;
  const placement = ratio < 0.33 ? "haut" : ratio < 0.66 ? "milieu" : "bas";
  return { present: true, count, firstText, placement };
}

/**
 * Résume le HTML d'une campagne en un objet compact de signaux exploitables.
 * Tolérant : entrée non-string ou vide → résumé neutre (jamais de throw).
 */
export function summarizeHtml(html: unknown): HtmlSummary {
  const safe = typeof html === "string" ? html : "";

  const titleMatch = safe.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? stripToText(titleMatch[1]).slice(0, 200) || null : null;

  const preview = findPreheader(safe);

  const text = stripToText(safe);
  const words = text ? text.split(" ") : [];
  const textExcerpt = words.slice(0, MAX_WORDS).join(" ");

  const linkCount = (safe.match(/<a\b[^>]*>/gi) || []).length;
  const imageCount = (safe.match(/<img\b[^>]*>/gi) || []).length;

  return {
    title,
    preview,
    wordCount: words.length,
    approxChars: text.length,
    linkCount,
    imageCount,
    textExcerpt,
    cta: detectCta(safe),
  };
}
