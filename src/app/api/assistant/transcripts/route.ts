import { NextRequest } from "next/server";
import { requireRead } from "@/lib/auth-server";
import { CHAT_TIMEOUTS, chatFetch, chatHeaders, handleAssistantError, relayJson } from "@/lib/chat-proxy";

// GET /api/assistant/transcripts?limit=50 — derniers transcripts anonymes.
// Lecture seule : requireRead. Porté depuis GET /transcripts de routes/assistant.js.
export async function GET(req: NextRequest) {
  try {
    await requireRead();
    const { searchParams } = new URL(req.url);
    const limit = searchParams.get("limit");
    const qs = limit ? `?limit=${encodeURIComponent(limit)}` : "";
    const upstream = await chatFetch(`/transcripts${qs}`, {
      headers: chatHeaders(),
      timeout: CHAT_TIMEOUTS.stats,
    });
    return await relayJson(upstream);
  } catch (error) {
    return handleAssistantError(error, "GET /api/assistant/transcripts");
  }
}
