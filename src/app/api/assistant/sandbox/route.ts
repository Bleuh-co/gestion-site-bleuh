import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireWrite } from "@/lib/auth-server";
import { CHAT_TIMEOUTS, chatFetch, chatHeaders, handleAssistantError, relayJson } from "@/lib/chat-proxy";

// SSE + longue durée potentielle : pas de runtime edge, pas de cache statique.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface SandboxBody {
  locale?: string;
  region?: string;
  messages?: unknown;
  configOverride?: unknown;
  sessionId?: string;
}

// POST /api/assistant/sandbox — mini-chat avec config NON publiée (relais SSE).
// Porté depuis POST /sandbox de routes/assistant.js. clientIpHash dérivé de
// session.email (jamais du client) : quota horaire par admin côté bleuh-chat.
export async function POST(req: NextRequest) {
  let upstream: Response;
  try {
    const session = await requireWrite();

    let body: SandboxBody = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const ipHash = crypto
      .createHash("sha256")
      .update(session.email || "sandbox")
      .digest("hex")
      .slice(0, 16);

    upstream = await chatFetch("/sandbox", {
      method: "POST",
      headers: chatHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        locale: body.locale,
        region: body.region,
        messages: body.messages,
        configOverride: body.configOverride || {},
        sessionId: body.sessionId,
        clientIpHash: `sandbox-${ipHash}`,
      }),
      timeout: CHAT_TIMEOUTS.sandbox,
    });
  } catch (error) {
    return handleAssistantError(error, "POST /api/assistant/sandbox");
  }

  const ct = upstream.headers.get("content-type") || "";
  // Erreur de validation (400 JSON) ou autre réponse non-SSE : relais JSON tel quel.
  if (!ct.includes("text/event-stream")) {
    return relayJson(upstream);
  }
  if (!upstream.body) {
    return new NextResponse(null, { status: upstream.status });
  }

  // upstream.body est déjà un ReadableStream Web (fetch natif) : relayé tel
  // quel en BodyInit, pas besoin de Readable.fromWeb comme côté Express.
  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
