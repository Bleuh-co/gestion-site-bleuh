import { NextRequest, NextResponse } from "next/server";
import { requireRead, requireWrite } from "@/lib/auth-server";
import { recordAudit } from "@/lib/audit";
import { CRON_HEADER, tokensMatch } from "@/lib/cron-token";
import { handleError } from "@/lib/products-service";
import { readSante, runSante } from "@/lib/gsc-sante-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** GET /api/gsc/sante — dernière vérification enregistrée ({ sante: null } avant la première). */
export async function GET() {
  try {
    await requireRead();
    return NextResponse.json({ sante: await readSante() });
  } catch (error) {
    return handleError(error, "GET /api/gsc/sante");
  }
}

/**
 * POST /api/gsc/sante — vérifie le plan du site déclaré à Google et relit
 * les pages que Google montre encore (voir lib/gsc-sante-pure.ts).
 *
 * Auth : en-tête `X-Cron-Token` == GSC_CRON_TOKEN (Cloud Scheduler,
 * `bleuh-gsc-sante`), sinon session gestionnaire+ (bouton de l'écran).
 */
export async function POST(req: NextRequest) {
  const cronToken = req.headers.get(CRON_HEADER);
  if (cronToken) {
    const expected = process.env.GSC_CRON_TOKEN;
    if (!expected) {
      return NextResponse.json(
        { error: "Vérification non configurée (GSC_CRON_TOKEN absent).", code: "not_configured" },
        { status: 503 }
      );
    }
    if (!tokensMatch(cronToken, expected)) {
      return NextResponse.json({ error: "Jeton cron invalide.", code: "unauthorized" }, { status: 401 });
    }
    try {
      return NextResponse.json({ ok: true, via: "cron", sante: await runSante() });
    } catch (error) {
      return handleError(error, "POST /api/gsc/sante");
    }
  }

  try {
    const session = await requireWrite();
    const sante = await runSante();
    await recordAudit(session, "gsc.sante.run", `gsc/${sante.siteUrl}`, {
      submitted: sante.plan?.submitted.length ?? 0,
      removed: sante.plan?.removed.length ?? 0,
      signals: sante.pages?.signals.length ?? 0,
    });
    return NextResponse.json({ ok: true, via: "session", sante });
  } catch (error) {
    return handleError(error, "POST /api/gsc/sante");
  }
}
