import { NextRequest } from "next/server";
import { requireWrite } from "@/lib/auth-server";
import { recordAudit } from "@/lib/audit";
import { CHAT_TIMEOUTS, chatFetch, chatHeaders, handleAssistantError, relayJson } from "@/lib/chat-proxy";

// Batterie de conformité : ~36 appels modèle, 30-90 s (jusqu'à 600 s de
// timeout upstream) — pas de runtime edge, pas de cache.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Limite Vercel (Cloud Run n'a en général pas de plafond aussi bas) ; sans
// effet ailleurs mais évite une coupure prématurée si jamais déployé dessus.
export const maxDuration = 600;

interface SelftestBody {
  only?: unknown;
  concurrency?: unknown;
}

// POST /api/assistant/selftest — lance la batterie de conformité côté bleuh-chat.
// Porté depuis POST /selftest de routes/assistant.js (Express désactive les
// timeouts Node ; ici on garde uniquement l'AbortSignal.timeout du fetch).
// recordAudit : pas d'équivalent Express, ajouté par cohérence avec le
// pattern audit du repo (n'échoue jamais l'action métier — best effort).
export async function POST(req: NextRequest) {
  try {
    const session = await requireWrite();

    let body: SelftestBody = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const upstream = await chatFetch("/selftest", {
      method: "POST",
      headers: chatHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        ...(Array.isArray(body.only) ? { only: body.only } : {}),
        ...(Number.isInteger(body.concurrency) ? { concurrency: body.concurrency } : {}),
      }),
      timeout: CHAT_TIMEOUTS.selftest,
    });

    if (upstream.ok) {
      await recordAudit(session, "assistant.selftest.run", "assistant/selftest", {});
    }

    return await relayJson(upstream);
  } catch (error) {
    return handleAssistantError(error, "POST /api/assistant/selftest");
  }
}
