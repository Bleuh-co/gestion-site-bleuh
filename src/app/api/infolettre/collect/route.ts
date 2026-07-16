import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { requireAudit } from "@/lib/auth-server";
import { recordAudit } from "@/lib/audit";
import { handleError } from "@/lib/products-service";
import { collectSnapshot } from "@/lib/infolettre-collect";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CRON_HEADER = "x-cron-token";

/** Comparaison à temps constant (anti timing-attack), robuste aux longueurs. */
function tokensMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    // Compare quand même contre soi-même pour ne pas court-circuiter le timing.
    timingSafeEqual(a, a);
    return false;
  }
  return timingSafeEqual(a, b);
}

/**
 * POST /api/infolettre/collect — capture et STOCKE l'état MailerLite.
 *
 * Machine-to-machine (cron) OU déclenchement manuel admin. Deux voies d'auth :
 *  1. En-tête `X-Cron-Token` == INFOLETTRE_CRON_TOKEN (comparaison temps constant).
 *  2. Sinon, session Administrateur (requireAudit) → collecte + audit.
 * Sinon → 401. Ne fuite jamais la clé ML ni le token.
 */
export async function POST(req: NextRequest) {
  const cronToken = req.headers.get(CRON_HEADER);

  // ── Voie 1 : cron (header présent) ───────────────────────────
  if (cronToken) {
    const expected = process.env.INFOLETTRE_CRON_TOKEN;
    if (!expected) {
      return NextResponse.json(
        { error: "Collecteur non configuré.", code: "not_configured" },
        { status: 503 }
      );
    }
    if (!tokensMatch(cronToken, expected)) {
      return NextResponse.json(
        { error: "Jeton cron invalide.", code: "unauthorized" },
        { status: 401 }
      );
    }
    try {
      const summary = await collectSnapshot();
      return NextResponse.json({ ok: true, via: "cron", ...summary });
    } catch (error) {
      return handleError(error, "POST /api/infolettre/collect (cron)");
    }
  }

  // ── Voie 2 : session Administrateur (déclenchement manuel) ────
  try {
    const session = await requireAudit();
    const summary = await collectSnapshot();
    await recordAudit(session, "infolettre.collect.manual", "infolettre", { ...summary });
    return NextResponse.json({ ok: true, via: "admin", ...summary });
  } catch (error) {
    return handleError(error, "POST /api/infolettre/collect (admin)");
  }
}
