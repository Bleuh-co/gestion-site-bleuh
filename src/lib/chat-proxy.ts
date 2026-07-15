import "server-only";
import { NextResponse } from "next/server";

// ==============================
// Proxy serveur vers le service bleuh-chat (bot public) — assistant admin.
// Porté depuis `Apps/Formulaire DB-Products-Master/routes/assistant.js`.
// Le header X-Chat-Token n'est JAMAIS exposé au client : injecté ici, côté
// serveur uniquement, à partir de CHAT_INTERNAL_TOKEN.
// ==============================

const CHAT_SERVICE_URL = (
  process.env.CHAT_SERVICE_URL || "https://bleuh-chat-fkdfx4bpva-ue.a.run.app"
).replace(/\/+$/, "");

export const CHAT_TIMEOUTS = {
  config: 30_000,
  sandbox: 120_000,
  selftest: 600_000,
  stats: 30_000,
} as const;

/** Erreur de proxy vers bleuh-chat ; `timeout=true` si dépassement de délai. */
export class ChatProxyError extends Error {
  timeout: boolean;
  constructor(message: string, timeout = false) {
    super(message);
    this.name = "ChatProxyError";
    this.timeout = timeout;
  }
}

/** En-têtes vers bleuh-chat : X-Chat-Token (secret serveur) + extras. */
export function chatHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    "X-Chat-Token": process.env.CHAT_INTERNAL_TOKEN || "",
    ...extra,
  };
}

interface ChatFetchOptions extends RequestInit {
  timeout?: number;
}

/** fetch vers bleuh-chat avec timeout ; ChatProxyError.timeout=true si dépassement. */
export async function chatFetch(path: string, options: ChatFetchOptions = {}): Promise<Response> {
  const { timeout, ...rest } = options;
  try {
    return await fetch(`${CHAT_SERVICE_URL}${path}`, {
      ...rest,
      signal: AbortSignal.timeout(timeout ?? CHAT_TIMEOUTS.config),
    });
  } catch (e) {
    if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")) {
      throw new ChatProxyError("Délai dépassé en contactant le service bleuh-chat.", true);
    }
    throw e;
  }
}

/** Relaye une réponse JSON (ou texte) de bleuh-chat avec son code HTTP. */
export async function relayJson(upstream: Response): Promise<NextResponse> {
  const text = await upstream.text();
  try {
    return NextResponse.json(JSON.parse(text), { status: upstream.status });
  } catch {
    return NextResponse.json(
      { success: upstream.ok, message: text.slice(0, 2000) },
      { status: upstream.status }
    );
  }
}

/**
 * Mappe une erreur de route Assistant vers la NextResponse appropriée :
 * UNAUTHORIZED/FORBIDDEN (requireRead/requireWrite) → 401/403 ; timeout
 * upstream → 504 ; autre erreur de proxy → 502 ; sinon 500 générique.
 */
export function handleAssistantError(error: unknown, context: string): NextResponse {
  if (error instanceof Error && error.message === "UNAUTHORIZED") {
    return NextResponse.json({ error: "Non authentifié.", code: "unauthorized" }, { status: 401 });
  }
  if (error instanceof Error && error.message === "FORBIDDEN") {
    return NextResponse.json({ error: "Accès refusé.", code: "forbidden" }, { status: 403 });
  }
  const message = error instanceof Error ? error.message : "Erreur interne.";
  console.error(`${context} :`, message);
  if (error instanceof ChatProxyError) {
    return NextResponse.json({ success: false, message }, { status: error.timeout ? 504 : 502 });
  }
  return NextResponse.json({ success: false, message }, { status: 500 });
}
