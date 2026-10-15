import "server-only";
import crypto from "node:crypto";
import sharp from "sharp";
import heicConvert from "heic-convert";

import {
  buildStudioAssetListParams,
  convertedFilename,
  detectStudioConversion,
  parseStudioDuplicateCheck,
} from "./studio-chanv-pure";

/**
 * Studio Chanv — bibliothèque d'assets de marque du groupe.
 *
 * AUTHENTIFICATION — en-tête `X-Gandalf-Ingest-Key` (STUDIO_INGEST_KEY).
 * C'est le MÊME mécanisme service-à-service que le pont Tâches ⇄ Studio du hub
 * (hub-chanv/lib/studio-bridge-watcher.js). Côté Studio (middleware/auth.js) la
 * clé est comparée à temps constant et confère l'identité `gandalf@chanv.com`
 * au rôle « Gestionnaire » — suffisant pour lister et déposer un asset.
 *
 * On n'utilise VOLONTAIREMENT PAS :
 *   - le relai du jeton Firebase de l'utilisateur (l'ancienne app Express le
 *     faisait ; ici la session est un cookie `__session`, pas un Bearer, et le
 *     relayer donnerait à Studio une identité qu'il ne sait pas mapper) ;
 *   - le secret cron `x-cron-secret`, qui vaut **Super Administrateur** sur
 *     Studio. Beaucoup trop large pour téléverser une image produit.
 *
 * ⚠️ STUDIO_CHANV_URL doit rester le domaine custom `https://studio.chanv.com`.
 * L'URL *.run.app répond 301 : `fetch` suivrait alors le POST en GET et on
 * récupérerait la LISTE des assets (sans `id`), corrompant l'opération en
 * silence. D'où `redirect: "error"` sur chaque appel — on échoue bruyamment.
 * (Incident vécu en production, cf. hub-chanv/deploy-us-east1.sh.)
 */

const STUDIO_URL = (process.env.STUDIO_CHANV_URL || "https://studio.chanv.com").replace(/\/+$/, "");
const INGEST_KEY = process.env.STUDIO_INGEST_KEY || "";

/** Marque et catégorie sous lesquelles les visuels produits sont classés. */
const BLEUH_BRAND = "bleuh";
const PACKAGING_CATEGORY = "packaging";

const LIST_TIMEOUT_MS = 15_000;
const DOWNLOAD_TIMEOUT_MS = 30_000;
const CHECK_DUPLICATE_TIMEOUT_MS = 10_000;
/** Le pipeline d'upload Studio (Drive + tag IA Gemini) est lent par nature. */
const UPLOAD_TIMEOUT_MS = 120_000;

export interface StudioAssetSummary {
  id: string;
  name: string;
  displayName: string;
  thumbUrl: string;
  format: string;
}

export interface StudioAssetPage {
  assets: StudioAssetSummary[];
  /** Encore des résultats disponibles après ceux-ci (« Voir plus »). */
  hasMore: boolean;
  /**
   * Curseur à renvoyer pour continuer à PARCOURIR (pas de recherche) —
   * `null` quand il n'y en a plus, ou quand une recherche est en cours
   * (Studio pagine alors par page, cf. buildStudioAssetListParams).
   */
  nextCursor: string | null;
  /** Page courante, pertinente seulement en mode recherche. */
  page: number;
}

export interface StudioAssetBytes {
  bytes: Buffer;
  contentType: string;
  filename: string | null;
}

/** Studio est-il joignable ? (clé de service posée sur le service) */
export function isStudioConfigured(): boolean {
  return Boolean(INGEST_KEY);
}

export function studioBaseUrl(): string {
  return STUDIO_URL;
}

function ingestHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return { "X-Gandalf-Ingest-Key": INGEST_KEY, ...extra };
}

async function studioFetch(path: string, init: RequestInit = {}, timeoutMs = LIST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(`${STUDIO_URL}${path}`, {
      ...init,
      headers: ingestHeaders((init.headers as Record<string, string>) || {}),
      redirect: "error",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * URL d'affichage d'un asset Studio — pour les VIGNETTES de l'écran d'admin
 * uniquement.
 *
 * ⚠️ Ne JAMAIS enregistrer cette URL comme image d'un produit : l'endpoint
 * `/thumb` de Studio est limité à 200 requêtes / 10 s partagées par TOUT le
 * trafic anonyme, réencode en JPEG et plafonne à 2000 px. Le site public doit
 * pointer sur une URL GCS permanente (cf. lib/product-images.ts).
 */
export function studioThumbUrl(assetId: string, size = 400): string {
  return `${STUDIO_URL}/api/assets/${encodeURIComponent(assetId)}/thumb?size=${size}`;
}

/**
 * Liste les images de la marque Bleuh, une page à la fois.
 *
 * Avant le 15/10/2026 : la fonction demandait les 60 images les plus
 * récentes et filtrait `query` EN LOCAL dans ces 60 — une image plus
 * ancienne que les 60 dernières était introuvable, quel que soit le terme
 * cherché. Depuis la refonte de la recherche côté Studio (Typesense + cache
 * d'embeddings, routes/assets.js `handleAssetList`, audit du 23/07/2026), le
 * paramètre `search` ne charge plus 5000 docs arbitraires : il interroge tout
 * le catalogue et pagine réellement. L'ancien commentaire sur un abort
 * systématique (>15 s) datait du chemin legacy d'avant cette refonte — il ne
 * décrit plus le comportement actuel, d'où le changement ici.
 *
 * Studio a DEUX pagination différentes selon qu'on cherche ou qu'on
 * parcourt (voir buildStudioAssetListParams) : sans recherche, on avance par
 * `cursor` (curseur Firestore, trié par récence) ; avec une recherche, on
 * avance par `page`. L'appelant doit donc renvoyer `cursor` OU `page` suivant
 * le cas — exactement ce que renvoie `StudioAssetPage`.
 */
export async function listBleuhImages(
  input: { query?: string; limit?: number; cursor?: string | null; page?: number } = {}
): Promise<StudioAssetPage> {
  if (!isStudioConfigured()) {
    throw new Error("STUDIO_INGEST_KEY absent : la bibliothèque Studio Chanv n'est pas branchée.");
  }
  const limit = Math.min(100, Math.max(1, input.limit ?? 60));
  const params = buildStudioAssetListParams({
    brand: BLEUH_BRAND,
    assetType: "image",
    limit,
    search: input.query ?? "",
    cursor: input.cursor ?? null,
    page: input.page ?? 1,
  });
  const res = await studioFetch(`/api/assets?${params.toString()}`);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Studio Chanv a répondu ${res.status}. ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as { assets?: unknown; pagination?: Record<string, unknown> };
  const raw = Array.isArray(data.assets) ? (data.assets as Record<string, unknown>[]) : [];

  const assets: StudioAssetSummary[] = raw
    .filter((a) => {
      if (!a || typeof a.id !== "string") return false;
      const mime = typeof a.mime_type === "string" ? a.mime_type : "";
      return a.asset_type === "image" || mime.startsWith("image/");
    })
    .map((a) => {
      const id = a.id as string;
      const name = typeof a.name === "string" ? a.name : "";
      const displayName = typeof a.display_name === "string" && a.display_name ? a.display_name : name;
      return {
        id,
        name,
        displayName,
        thumbUrl: studioThumbUrl(id, 400),
        format: typeof a.format === "string" ? a.format : "",
      };
    });

  const pagination = data.pagination ?? {};
  return {
    assets,
    hasMore: Boolean(pagination.hasNext),
    nextCursor: typeof pagination.nextCursor === "string" ? pagination.nextCursor : null,
    page: typeof pagination.page === "number" ? pagination.page : input.page ?? 1,
  };
}

/**
 * Récupère les octets d'un asset Studio : l'original d'abord, sinon une grande
 * vignette. `/download` peut renvoyer une redirection Drive légitime — c'est le
 * seul appel où l'on suit les redirects, et il est en GET (aucun risque de
 * dégradation POST → GET).
 */
export async function downloadStudioAsset(assetId: string): Promise<StudioAssetBytes> {
  if (!isStudioConfigured()) {
    throw new Error("STUDIO_INGEST_KEY absent : la bibliothèque Studio Chanv n'est pas branchée.");
  }
  const base = `/api/assets/${encodeURIComponent(assetId)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${STUDIO_URL}${base}/download`, {
      headers: ingestHeaders(),
      redirect: "follow",
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn(`[studio] download ${assetId} → ${res.status}, repli sur la vignette 2000px.`);
      res = await fetch(`${STUDIO_URL}${base}/thumb?size=2000`, {
        headers: ingestHeaders(),
        redirect: "error",
        signal: controller.signal,
      });
    }
  } finally {
    clearTimeout(timer);
  }

  // 204 = Studio n'a pas encore de vignette prête pour cet asset.
  if (!res.ok || res.status === 204) {
    throw new Error(`Image indisponible dans Studio Chanv (HTTP ${res.status}).`);
  }
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length === 0) {
    throw new Error("Studio Chanv a renvoyé une image vide.");
  }

  let filename: string | null = null;
  const disposition = res.headers.get("content-disposition") || "";
  const match = disposition.match(/filename="([^"]+)"/);
  if (match) {
    try {
      filename = decodeURIComponent(match[1]);
    } catch {
      filename = match[1];
    }
  }

  const contentType = res.headers.get("content-type") || "application/octet-stream";

  // HEIC/TIFF : le site ne les accepte pas (lib/product-images.ts,
  // ALLOWED_IMAGE_MIME) — l'image choisie dans Studio serait rejetée par
  // `assertUploadableImage` au lieu d'être utilisable. On convertit ici,
  // avant que l'appelant (route image-from-studio) n'écrive dans le bucket,
  // pour que la conversion soit systématique quel que soit l'appelant futur.
  const conversion = detectStudioConversion(contentType, filename);
  if (conversion) {
    try {
      const jpegBytes = await convertToJpeg(bytes, conversion);
      return {
        bytes: jpegBytes,
        contentType: "image/jpeg",
        filename: convertedFilename(filename, assetId),
      };
    } catch (e) {
      throw new Error(
        `Image ${conversion.toUpperCase()} reçue de Studio Chanv, conversion en JPEG impossible : ${
          e instanceof Error ? e.message : String(e)
        }`
      );
    }
  }

  return { bytes, contentType, filename };
}

/** Convertit des octets HEIC/HEIF ou TIFF en JPEG. */
async function convertToJpeg(bytes: Buffer, kind: "heic" | "tiff"): Promise<Buffer> {
  if (kind === "tiff") {
    // sharp (libvips) lit le TIFF nativement, aucune dépendance supplémentaire.
    return sharp(bytes).jpeg({ quality: 90 }).toBuffer();
  }
  // HEIC/HEIF : les binaires sharp/libvips publiés sur npm n'embarquent PAS le
  // décodeur HEIF (licence) — seul AVIF est supporté en entrée (vérifié le
  // 15/10/2026 : `sharp.format.heif.input.fileSuffix` ne contient que
  // `.avif`). `heic-convert` décode en JS pur (heic-decode/libheif en wasm),
  // sans compilation native, donc sans risque de rupture sur `npm run build`.
  return heicConvert({ buffer: bytes, format: "JPEG", quality: 0.92 });
}

/**
 * Demande à Studio si l'un de ces hachages SHA-256 est déjà dans sa
 * bibliothèque (`POST /api/assets/check-duplicates`), SANS envoyer les
 * octets. Sert à éviter d'envoyer le fichier en entier (jusqu'à 15 Mo, pipeline
 * de dépôt de plusieurs dizaines de secondes) quand on sait déjà qu'il existe.
 *
 * ⚠️ Limite constatée côté Studio (routes/assets.js, check-duplicates) : la
 * réponse ne contient QUE les hachages trouvés (`duplicate_hashes`), jamais
 * l'id de l'asset existant — contrairement au 409 de `POST /api/assets`, qui
 * lui renvoie `existing_id`. On ne peut donc que SAUTER l'envoi, pas retrouver
 * l'id de la fiche déjà présente par ce chemin.
 *
 * Retourne `false` (pas de doublon connu) en cas de panne Studio — un faux
 * négatif ici fait juste retomber sur le dépôt normal, qui dédoublonne lui
 * aussi par hachage (comportement inchangé) ; ce n'est jamais bloquant.
 */
async function isKnownDuplicate(contentHash: string): Promise<boolean> {
  try {
    const res = await studioFetch(
      "/api/assets/check-duplicates",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ hashes: [contentHash] }),
      },
      CHECK_DUPLICATE_TIMEOUT_MS
    );
    if (!res.ok) return false;
    const data = await res.json().catch(() => null);
    return parseStudioDuplicateCheck(data).duplicateHashes.has(contentHash);
  } catch (e) {
    console.warn("[studio] check-duplicates indisponible, on tente le dépôt normal :", e instanceof Error ? e.message : e);
    return false;
  }
}

/**
 * Dépose une image dans la bibliothèque Studio, classée comme visuel de
 * packaging officiel Bleuh (Drive « Bleuh/Logos et trousse graphique »,
 * tag IA, index de recherche).
 *
 * Studio dédoublonne par SHA-256 : un 409 signifie « déjà connue » et renvoie
 * l'id existant — c'est un SUCCÈS, pas une erreur (même lecture que le pont du
 * hub). Retourne `null` si Studio n'est pas branché ou refuse : le dépôt dans
 * la bibliothèque est un enrichissement, jamais un bloquant pour l'utilisateur.
 *
 * Avant d'envoyer les octets, on vérifie par `isKnownDuplicate` si Studio a
 * déjà ce fichier (pré-contrôle léger) — ça évite l'envoi complet (jusqu'à
 * 15 Mo) quand on sait déjà que ce sera un doublon. Le fichier envoyé porte
 * aussi `content_hash` (le même SHA-256) et `source_url` quand elle est
 * connue : Studio ne les lit pas encore aujourd'hui (son dédoublonnage
 * recalcule son propre hachage à la réception), mais ils sont prêts pour le
 * jour où l'import de nuit (routes/bleuh-import.js, qui ne compare que les
 * noms de fichiers qu'il a lui-même importés) voudra dédoublonner par
 * contenu plutôt que par nom — voir le rapport joint pour le changement
 * Studio correspondant.
 */
export async function pushImageToStudio(input: {
  bytes: Buffer;
  filename: string;
  mimeType: string;
  displayName?: string;
  tags?: string[];
  /** URL publique déjà connue de cette image sur bleuh.co, si elle existe. */
  sourceUrl?: string;
}): Promise<string | null> {
  if (!isStudioConfigured()) {
    console.warn("[studio] STUDIO_INGEST_KEY absent — image non versée à la bibliothèque Studio.");
    return null;
  }
  const contentHash = crypto.createHash("sha256").update(input.bytes).digest("hex");
  try {
    if (await isKnownDuplicate(contentHash)) {
      console.log(`[studio] image déjà connue (hash ${contentHash.slice(0, 12)}…) — dépôt sauté.`);
      return null;
    }

    const form = new FormData();
    form.append(
      "file",
      new Blob([new Uint8Array(input.bytes)], { type: input.mimeType }),
      input.filename
    );
    form.append("brand", BLEUH_BRAND);
    form.append("category", PACKAGING_CATEGORY);
    if (input.displayName) form.append("display_name", input.displayName.slice(0, 200));
    const tags = ["produit", "site bleuh", ...(input.tags ?? [])];
    form.append("tags", tags.join(","));
    // Ignorés par Studio aujourd'hui (champs non lus par handleAssetUpload) —
    // posés pour le dédoublonnage par contenu de l'import de nuit, cf. docstring.
    form.append("content_hash", contentHash);
    if (input.sourceUrl) form.append("source_url", input.sourceUrl);

    // Pas de Content-Type manuel : FormData pose lui-même la frontière multipart.
    const res = await studioFetch("/api/assets", { method: "POST", body: form }, UPLOAD_TIMEOUT_MS);

    if (res.status === 409) {
      const dup = (await res.json().catch(() => ({}))) as { existing_id?: string };
      if (dup.existing_id) {
        console.log(`[studio] image déjà dans la bibliothèque → ${dup.existing_id}`);
        return dup.existing_id;
      }
      console.warn("[studio] doublon signalé sans existing_id.");
      return null;
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.warn(`[studio] dépôt refusé (${res.status}) : ${body.slice(0, 200)}`);
      return null;
    }
    const created = (await res.json()) as { id?: string };
    if (!created.id) {
      console.warn("[studio] réponse de dépôt sans id.");
      return null;
    }
    console.log(`[studio] image versée à la bibliothèque Bleuh → ${created.id}`);
    return created.id;
  } catch (e) {
    console.warn("[studio] dépôt impossible :", e instanceof Error ? e.message : e);
    return null;
  }
}
