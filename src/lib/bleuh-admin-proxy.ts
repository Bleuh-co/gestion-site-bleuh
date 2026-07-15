import "server-only";
import { NextResponse } from "next/server";

// ─────────────────────────────────────────────────────────────
// Proxy admin BleuhAPI — module Outils.
// Porté depuis routes/operations.js (Formulaire DB-Products-Master) :
// proxy 1:1 vers BleuhAPI /admin/* avec injection serveur du header
// X-Admin-Token. Ce n'est PAS un CRUD Firestore — voir brief de portage.
// ─────────────────────────────────────────────────────────────

const BLEUHAPI_URL = (
  process.env.BLEUHAPI_URL || "https://bleuhapi-271227085398.northamerica-northeast1.run.app"
).replace(/\/+$/, "");

/** Timeouts par type d'action — repris tel quel de routes/operations.js. */
export const TIMEOUTS = {
  status: 30_000,
  export: 120_000,
  sync: 300_000,
  overrides: 60_000,
  tool: 300_000,
  metrogreen: 30_000,
  upload: 300_000,
} as const;

export const SYNC_TARGETS = ["ontario", "lots", "deliveries", "store-locator", "inventory-web-sftp"] as const;
export type SyncTarget = (typeof SYNC_TARGETS)[number];

export const EXPORT_EXTS = ["xlsx", "csv", "pdf"] as const;
export type ExportExt = (typeof EXPORT_EXTS)[number];

/** Erreur de proxy typée : distingue timeout (→504) des autres échecs réseau (→502). */
export class BleuhProxyError extends Error {
  timeout: boolean;
  constructor(message: string, timeout = false) {
    super(message);
    this.name = "BleuhProxyError";
    this.timeout = timeout;
  }
}

interface BleuhFetchOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: BodyInit | null;
  timeout?: number;
  /** Requis par le runtime Node (undici) pour un fetch avec un body en flux. */
  duplex?: "half";
  cache?: RequestCache;
}

/**
 * fetch vers BleuhAPI (BLEUHAPI_URL + path) avec injection automatique de
 * X-Admin-Token (jamais exposée au client — lue depuis BLEUH_ADMIN_TOKEN
 * côté serveur uniquement) et timeout par action. Porté depuis
 * bleuhFetch()/adminHeaders() de routes/operations.js : distingue
 * TimeoutError/AbortError (→ BleuhProxyError.timeout = true, mappé 504)
 * des autres échecs réseau (mappés 502 par outilsErrorResponse ci-dessous).
 */
export async function bleuhFetch(path: string, options: BleuhFetchOptions = {}): Promise<Response> {
  const { timeout, headers, duplex, ...init } = options;
  const finalHeaders: Record<string, string> = {
    "X-Admin-Token": process.env.BLEUH_ADMIN_TOKEN || "",
    ...headers,
  };
  const fetchInit: RequestInit & { duplex?: "half" } = {
    ...init,
    headers: finalHeaders,
  };
  if (duplex) fetchInit.duplex = duplex;

  try {
    return await fetch(`${BLEUHAPI_URL}${path}`, {
      ...fetchInit,
      signal: AbortSignal.timeout(timeout || TIMEOUTS.status),
    });
  } catch (e) {
    if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")) {
      throw new BleuhProxyError("Délai dépassé en contactant BleuhAPI.", true);
    }
    throw e;
  }
}

/** Relaye une réponse JSON (ou texte non-JSON) de BleuhAPI en NextResponse, code HTTP préservé. */
export async function relayJson(upstream: Response): Promise<NextResponse> {
  const text = await upstream.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    data = { success: upstream.ok, message: text.slice(0, 2000) };
  }
  return NextResponse.json(data, { status: upstream.status });
}

/** Headers binaires à relayer pour un download (content-type/disposition/length). */
export function binaryHeaders(upstream: Response): Headers {
  const headers = new Headers();
  for (const h of ["content-type", "content-disposition", "content-length"]) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }
  return headers;
}

/**
 * Convertit une erreur (requireRead/requireWrite ou échec de proxy réseau)
 * en NextResponse avec le bon code HTTP : UNAUTHORIZED→401, FORBIDDEN→403,
 * timeout→504, autre échec réseau→502. Ne loggue jamais le token admin
 * (absent de error.message — bleuhFetch ne l'y inclut jamais).
 */
export function outilsErrorResponse(error: unknown, context: string): NextResponse {
  if (error instanceof Error && error.message === "UNAUTHORIZED") {
    return NextResponse.json({ success: false, message: "Non authentifié." }, { status: 401 });
  }
  if (error instanceof Error && error.message === "FORBIDDEN") {
    return NextResponse.json({ success: false, message: "Accès refusé." }, { status: 403 });
  }
  const message = error instanceof Error ? error.message : "Erreur inconnue.";
  console.error(`${context} :`, message);
  const status = error instanceof BleuhProxyError && error.timeout ? 504 : 502;
  return NextResponse.json({ success: false, message }, { status });
}
