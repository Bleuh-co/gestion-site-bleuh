import "server-only";

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
/** Le pipeline d'upload Studio (Drive + tag IA Gemini) est lent par nature. */
const UPLOAD_TIMEOUT_MS = 120_000;

export interface StudioAssetSummary {
  id: string;
  name: string;
  displayName: string;
  thumbUrl: string;
  format: string;
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
 * Liste les images de la marque Bleuh, filtrées localement sur `query`.
 *
 * Le paramètre `search` de Studio déclenche un chemin de recherche lent
 * (>15 s à froid → abort systématique constaté en production, cf.
 * hub-chanv/lib/brand-guide.js). On liste donc la marque — rapide — et on
 * classe ici.
 */
export async function listBleuhImages(query = "", limit = 60): Promise<StudioAssetSummary[]> {
  if (!isStudioConfigured()) {
    throw new Error("STUDIO_INGEST_KEY absent : la bibliothèque Studio Chanv n'est pas branchée.");
  }
  const params = new URLSearchParams({
    brand: BLEUH_BRAND,
    asset_type: "image",
    limit: String(limit),
  });
  const res = await studioFetch(`/api/assets?${params.toString()}`);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Studio Chanv a répondu ${res.status}. ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as { assets?: unknown };
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

  const q = query.trim().toLowerCase();
  if (!q) return assets;
  const terms = q.split(/\s+/).filter(Boolean);
  return assets.filter((a) => {
    const haystack = `${a.displayName} ${a.name}`.toLowerCase();
    return terms.every((t) => haystack.includes(t));
  });
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

  return {
    bytes,
    contentType: res.headers.get("content-type") || "application/octet-stream",
    filename,
  };
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
 */
export async function pushImageToStudio(input: {
  bytes: Buffer;
  filename: string;
  mimeType: string;
  displayName?: string;
  tags?: string[];
}): Promise<string | null> {
  if (!isStudioConfigured()) {
    console.warn("[studio] STUDIO_INGEST_KEY absent — image non versée à la bibliothèque Studio.");
    return null;
  }
  try {
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
