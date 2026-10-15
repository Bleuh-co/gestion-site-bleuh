/**
 * Studio Chanv — logique pure (détection de format à convertir, construction
 * des paramètres de requête, lecture des réponses). Aucun import réseau,
 * aucun "server-only" : testable directement par `node --test`, même
 * convention que lib/acquisition-pure.ts.
 *
 * La partie qui parle réellement au réseau (fetch, clé de service) vit dans
 * lib/studio-chanv.ts, qui importe ces fonctions.
 */

export type StudioConversionKind = "heic" | "tiff" | null;

const HEIC_MIME = new Set(["image/heic", "image/heif"]);
const TIFF_MIME = new Set(["image/tiff", "image/x-tiff"]);

/**
 * Le site n'accepte que PNG/JPEG/WebP/GIF/AVIF/SVG en image de produit
 * (lib/product-images.ts, ALLOWED_IMAGE_MIME) : une image Studio en HEIC ou
 * TIFF doit être convertie AVANT d'atteindre `saveProductImage`, sinon
 * `assertUploadableImage` la rejette avec un message qui ne dit pas qu'une
 * conversion était possible.
 *
 * Studio renvoie parfois `application/octet-stream` pour ces deux formats
 * (constaté sur le repli `/thumb`) : on retombe sur l'extension du nom de
 * fichier quand le type MIME ne tranche pas.
 */
export function detectStudioConversion(contentType: string, filename: string | null): StudioConversionKind {
  const mime = (contentType || "").toLowerCase().split(";")[0].trim();
  if (HEIC_MIME.has(mime)) return "heic";
  if (TIFF_MIME.has(mime)) return "tiff";

  const ext = (filename || "").toLowerCase().split(".").pop() || "";
  if (ext === "heic" || ext === "heif") return "heic";
  if (ext === "tif" || ext === "tiff") return "tiff";
  return null;
}

/** Nom de fichier après conversion : même base, extension `.jpg`. */
export function convertedFilename(filename: string | null, fallback: string): string {
  const source = filename || fallback || "image";
  const base = source.replace(/\.[^./\\]+$/, "") || "image";
  return `${base}.jpg`;
}

export interface StudioAssetListParams {
  brand: string;
  assetType: string;
  limit: number;
  search: string;
  /** Curseur Studio (mode « parcourir », tri récent) — ignoré si `search`. */
  cursor?: string | null;
  /** Page Studio (mode « recherche ») — ignoré si pas de `search`. */
  page?: number;
}

/**
 * Construit les paramètres de `GET /api/assets` côté Studio.
 *
 * Studio a DEUX mécanismes de pagination distincts (routes/assets.js,
 * handleAssetList) : un curseur Firestore natif quand il n'y a pas de filtre
 * post-requête (le cas « parcourir », trié par récence), et une pagination
 * par page/offset dès qu'une recherche est demandée (Typesense, puis cache
 * d'embeddings, puis repli legacy). Envoyer `page` en mode curseur ne ferait
 * rien avancer — Studio n'y regarde `page` que pour l'affichage, l'avance se
 * fait par `cursor` — d'où le choix explicite ici plutôt qu'un seul paramètre
 * générique.
 */
export function buildStudioAssetListParams(input: StudioAssetListParams): URLSearchParams {
  const params = new URLSearchParams({
    brand: input.brand,
    asset_type: input.assetType,
    limit: String(input.limit),
    sort: "recent",
  });

  const search = input.search.trim();
  if (search) {
    params.set("search", search);
    params.set("page", String(Math.max(1, input.page ?? 1)));
  } else if (input.cursor) {
    params.set("cursor", input.cursor);
  }

  return params;
}

export interface StudioDuplicateCheck {
  duplicateHashes: Set<string>;
}

/** Lit la réponse de `POST /api/assets/check-duplicates`. */
export function parseStudioDuplicateCheck(data: unknown): StudioDuplicateCheck {
  const body = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  const list = Array.isArray(body.duplicate_hashes) ? body.duplicate_hashes : [];
  return {
    duplicateHashes: new Set(list.filter((h): h is string => typeof h === "string")),
  };
}
