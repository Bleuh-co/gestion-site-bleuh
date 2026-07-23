import "server-only";
import { NextResponse } from "next/server";

// ─────────────────────────────────────────────────────────────
// Proxy admin WooCommerce — module Shop (bleuh.shop).
// Calqué sur src/lib/bleuh-admin-proxy.ts (module Outils) : fetch server-only
// vers l'API REST WooCommerce v3, injection serveur de l'auth Basic ck/cs
// (jamais exposée au client, jamais préfixée NEXT_PUBLIC_).
// ⚠️ bleuh.shop est la boutique LIVE en production — ce proxy relaie des
// écritures réelles (PATCH produit, statut commande, création/suppression de
// coupon). Aucun test automatisé de ce fichier ne doit appeler l'API réelle
// en écriture.
// ─────────────────────────────────────────────────────────────

const WOO_STORE_URL = (process.env.WOO_STORE_URL || "https://bleuh.shop").replace(/\/+$/, "");
const WOO_API_BASE = `${WOO_STORE_URL}/wp-json/wc/v3`;

/** Timeouts par type d'action (l'API Woo répond vite ; les rapports peuvent être plus lents). */
export const TIMEOUTS = {
  read: 15_000,
  write: 20_000,
  stats: 25_000,
} as const;

/** Erreur de proxy typée : distingue timeout (→504) des autres échecs réseau (→502). */
export class WooProxyError extends Error {
  timeout: boolean;
  constructor(message: string, timeout = false) {
    super(message);
    this.name = "WooProxyError";
    this.timeout = timeout;
  }
}

interface WooFetchOptions {
  method?: string;
  /** Corps JSON-sérialisable — jamais un BodyInit brut (toujours du JSON côté API Woo). */
  body?: unknown;
  searchParams?: Record<string, string | number | boolean | undefined | null>;
  timeout?: number;
}

function buildAuthHeader(): string {
  const key = process.env.WOO_CONSUMER_KEY || "";
  const secret = process.env.WOO_CONSUMER_SECRET || "";
  return `Basic ${Buffer.from(`${key}:${secret}`).toString("base64")}`;
}

/**
 * fetch vers l'API REST WooCommerce (WOO_STORE_URL + /wp-json/wc/v3 + path)
 * avec injection automatique de l'auth Basic (WOO_CONSUMER_KEY/SECRET, lues
 * côté serveur uniquement, jamais loguées) et timeout par action. Distingue
 * TimeoutError/AbortError (→ WooProxyError.timeout = true, mappé 504) des
 * autres échecs réseau (mappés 502 par shopErrorResponse ci-dessous).
 */
export async function wooFetch(path: string, options: WooFetchOptions = {}): Promise<Response> {
  const { method = "GET", body, searchParams, timeout } = options;

  const url = new URL(`${WOO_API_BASE}${path}`);
  if (searchParams) {
    for (const [k, v] of Object.entries(searchParams)) {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
    }
  }

  const headers: Record<string, string> = {
    Authorization: buildAuthHeader(),
    Accept: "application/json",
    // SiteGround (hébergeur de bleuh.shop) sert une page HTML anti-bot aux
    // requêtes sans User-Agent de navigateur venant d'IP datacenter (Cloud
    // Run) — un UA réaliste est requis pour recevoir du JSON.
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 GestionSiteBleuh/1.0",
  };
  let payload: string | undefined;
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  try {
    return await fetch(url.toString(), {
      method,
      headers,
      body: payload,
      cache: "no-store",
      signal: AbortSignal.timeout(timeout || TIMEOUTS.read),
    });
  } catch (e) {
    if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")) {
      throw new WooProxyError("Délai dépassé en contactant l'API WooCommerce.", true);
    }
    throw e;
  }
}

/**
 * Relaye une réponse de l'API Woo en NextResponse JSON, code HTTP préservé.
 * Les endpoints de LISTE renvoient un tableau JSON + en-têtes X-WP-Total /
 * X-WP-TotalPages (pagination WooCommerce) : on les préserve en enveloppant
 * dans { items, total, totalPages }. Les endpoints d'un seul objet (détail,
 * PUT/POST/DELETE) sont relayés tels quels. Corps non-JSON (ex. HTML si les
 * clés sont absentes/mal configurées) → jamais relayé brut au client.
 */
export async function relayWooJson(upstream: Response): Promise<NextResponse> {
  const text = await upstream.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return NextResponse.json(
      {
        success: false,
        message: upstream.ok
          ? `Réponse inattendue (non-JSON) de l'API WooCommerce — HTTP ${upstream.status}.`
          : `Service indisponible ou non configuré (API WooCommerce) — HTTP ${upstream.status}.`,
      },
      { status: upstream.status }
    );
  }

  if (Array.isArray(data)) {
    const total = Number(upstream.headers.get("x-wp-total") ?? data.length);
    const totalPages = Number(upstream.headers.get("x-wp-totalpages") ?? 1);
    return NextResponse.json({ items: data, total: Number.isFinite(total) ? total : data.length, totalPages: Number.isFinite(totalPages) ? totalPages : 1 }, { status: upstream.status });
  }

  return NextResponse.json(data, { status: upstream.status });
}

/**
 * Convertit une erreur (requireRead/requireWrite ou échec de proxy réseau)
 * en NextResponse avec le bon code HTTP : UNAUTHORIZED→401, FORBIDDEN→403,
 * timeout→504, autre échec réseau→502. Ne loggue jamais la clé/secret Woo
 * (absents de error.message — wooFetch ne les y inclut jamais).
 */
export function shopErrorResponse(error: unknown, context: string): NextResponse {
  if (error instanceof Error && error.message === "UNAUTHORIZED") {
    return NextResponse.json({ success: false, message: "Non authentifié." }, { status: 401 });
  }
  if (error instanceof Error && error.message === "FORBIDDEN") {
    return NextResponse.json({ success: false, message: "Accès refusé." }, { status: 403 });
  }
  const message = error instanceof Error ? error.message : "Erreur inconnue.";
  console.error(`${context} :`, message);
  const status = error instanceof WooProxyError && error.timeout ? 504 : 502;
  return NextResponse.json({ success: false, message }, { status });
}
