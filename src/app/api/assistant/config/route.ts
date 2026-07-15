import { NextRequest, NextResponse } from "next/server";
import { requireRead, requireWrite } from "@/lib/auth-server";
import { recordAudit } from "@/lib/audit";
import { CHAT_TIMEOUTS, chatFetch, chatHeaders, handleAssistantError, relayJson } from "@/lib/chat-proxy";

// GET /api/assistant/config — config publiée (bot public) + socle légal.
// Lecture seule : requireRead. Porté depuis GET /config de routes/assistant.js.
export async function GET() {
  try {
    await requireRead();
    const upstream = await chatFetch("/admin-config", {
      headers: chatHeaders(),
      timeout: CHAT_TIMEOUTS.config,
    });
    return await relayJson(upstream);
  } catch (error) {
    return handleAssistantError(error, "GET /api/assistant/config");
  }
}

// PUT /api/assistant/config — publication d'une nouvelle version.
// updatedBy = session.email (serveur), JAMAIS la valeur envoyée par le client.
// Porté depuis PUT /config de routes/assistant.js ; recordAudit ajouté (pas
// d'équivalent Express) après confirmation du succès upstream uniquement.
export async function PUT(req: NextRequest) {
  try {
    const session = await requireWrite();

    let body: { config?: unknown } = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const upstream = await chatFetch("/admin-config", {
      method: "PUT",
      headers: chatHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        config: body.config || {},
        updatedBy: session.email,
      }),
      timeout: CHAT_TIMEOUTS.config,
    });

    const text = await upstream.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { success: upstream.ok, message: text.slice(0, 2000) };
    }

    if (upstream.ok) {
      const version = (parsed as { version?: unknown } | null)?.version;
      await recordAudit(session, "assistant.config.publish", "assistant/config", { version });
    }

    return NextResponse.json(parsed as object, { status: upstream.status });
  } catch (error) {
    return handleAssistantError(error, "PUT /api/assistant/config");
  }
}
