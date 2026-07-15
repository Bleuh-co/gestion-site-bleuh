import { requireRead } from "@/lib/auth-server";
import { CHAT_TIMEOUTS, chatFetch, chatHeaders, handleAssistantError, relayJson } from "@/lib/chat-proxy";

// GET /api/assistant/stats — volume/jour (7 j), taux d'escalade, dépense estimée.
// Lecture seule : requireRead. Porté depuis GET /stats de routes/assistant.js.
export async function GET() {
  try {
    await requireRead();
    const upstream = await chatFetch("/stats", {
      headers: chatHeaders(),
      timeout: CHAT_TIMEOUTS.stats,
    });
    return await relayJson(upstream);
  } catch (error) {
    return handleAssistantError(error, "GET /api/assistant/stats");
  }
}
