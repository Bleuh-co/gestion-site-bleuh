import "server-only";
import { adminBucket } from "./firebase-admin";
import { ValidationError } from "./products-service";

/**
 * Images produits — dépôt dans Cloud Storage et URL publique permanente.
 *
 * POURQUOI GCS ET PAS L'URL STUDIO ?
 * L'URL affichable d'un asset Studio (`/api/assets/:id/thumb`) est limitée à
 * 200 requêtes / 10 s partagées par tout le trafic anonyme, réencode en JPEG et
 * plafonne à 2000 px. La stocker comme image de produit ferait dépendre
 * bleuh.co de Studio à chaque page vue. Les octets vivent donc dans le bucket
 * public du projet — exactement là où sont déjà toutes les images du catalogue
 * (`site-assets/uploads/AAAA/MM/…`) — et Studio reçoit sa copie en parallèle
 * pour la bibliothèque de marque (cf. lib/studio-chanv.ts).
 *
 * C'est aussi le sens de lecture de Studio lui-même : son import Bleuh
 * (studio-chanv/routes/bleuh-import.js) traite la collection Firestore
 * `products` comme la SOURCE DE VÉRITÉ du packaging officiel du site.
 */

/** Préfixe historique des images du catalogue dans le bucket. */
const UPLOAD_FOLDER = "site-assets/uploads";

export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

/**
 * Formats acceptés — intersection de ce que sert le site et de ce que Studio
 * accepte (studio-chanv/routes/assets.js, ALLOWED_MIME_TYPES).
 */
export const ALLOWED_IMAGE_MIME = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/svg+xml",
] as const;

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "image/svg+xml": "svg",
};

export interface StoredImage {
  url: string;
  path: string;
  filename: string;
}

/**
 * Nom de fichier sûr pour une URL publique : accents aplatis, séparateurs
 * normalisés. Les images du catalogue gardent leur nom lisible
 * (« Blakh-Haze.png ») — c'est ce nom que Studio utilise pour dédoublonner.
 */
export function sanitizeFileName(name: string): string {
  return (
    String(name || "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 120) || "image"
  );
}

/** Sépare « photo.png » en { base: "photo", ext: "png" }. */
function splitName(filename: string, mimeType: string): { base: string; ext: string } {
  const fallbackExt = EXTENSION_BY_MIME[mimeType] || "bin";
  const dot = filename.lastIndexOf(".");
  if (dot <= 0 || dot === filename.length - 1) {
    return { base: filename || "image", ext: fallbackExt };
  }
  return { base: filename.slice(0, dot), ext: filename.slice(dot + 1).toLowerCase() };
}

/** Valide type et poids avant tout appel réseau. */
export function assertUploadableImage(mimeType: string, size: number): void {
  if (!(ALLOWED_IMAGE_MIME as readonly string[]).includes(mimeType)) {
    throw new ValidationError(
      `Format d'image non pris en charge (${mimeType || "inconnu"}). Formats acceptés : PNG, JPEG, WebP, GIF, AVIF, SVG.`
    );
  }
  if (size <= 0) {
    throw new ValidationError("Le fichier reçu est vide.");
  }
  if (size > MAX_IMAGE_BYTES) {
    throw new ValidationError(
      `Image trop lourde (${(size / 1024 / 1024).toFixed(1)} Mo). Maximum : ${MAX_IMAGE_BYTES / 1024 / 1024} Mo.`
    );
  }
}

/**
 * Écrit l'image dans le bucket et renvoie son URL publique permanente.
 *
 * Le nom d'origine est conservé (lisibilité de la bibliothèque de marque) ; en
 * cas de collision on suffixe `-2`, `-3`… plutôt que d'écraser l'image d'un
 * autre produit.
 */
export async function saveProductImage(input: {
  bytes: Buffer;
  filename: string;
  mimeType: string;
}): Promise<StoredImage> {
  assertUploadableImage(input.mimeType, input.bytes.length);

  const bucket = adminBucket();
  const now = new Date();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const { base, ext } = splitName(sanitizeFileName(input.filename), input.mimeType);

  let filename = `${base}.${ext}`;
  let filePath = `${UPLOAD_FOLDER}/${year}/${month}/${filename}`;
  for (let i = 2; i <= 50; i++) {
    const [exists] = await bucket.file(filePath).exists();
    if (!exists) break;
    filename = `${base}-${i}.${ext}`;
    filePath = `${UPLOAD_FOLDER}/${year}/${month}/${filename}`;
  }

  const file = bucket.file(filePath);
  await file.save(input.bytes, {
    contentType: input.mimeType,
    metadata: { cacheControl: "public, max-age=31536000" },
  });

  // URL publique stable si possible, sinon URL signée de très longue durée
  // (repli utile si le bucket passait un jour en accès uniforme).
  let url: string;
  try {
    await file.makePublic();
    url = `https://storage.googleapis.com/${bucket.name}/${encodeURI(filePath)}`;
  } catch (e) {
    console.warn(
      "[produits/image] makePublic refusé, repli sur URL signée :",
      e instanceof Error ? e.message : e
    );
    const [signedUrl] = await file.getSignedUrl({ action: "read", expires: "03-01-2500" });
    url = signedUrl;
  }

  return { url, path: filePath, filename };
}
