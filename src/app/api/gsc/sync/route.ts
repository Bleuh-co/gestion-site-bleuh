import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { requireWrite } from "@/lib/auth-server";
import { recordAudit } from "@/lib/audit";
import { handleError } from "@/lib/products-service";
import { defaultSyncDates, listDates } from "@/lib/gsc-pure";
import { syncDates, GscApiError } from "@/lib/gsc-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CRON_HEADER = "x-cron-token";

/** Comparaison à temps constant (même contrat que /api/infolettre/collect). */
function tokensMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    timingSafeEqual(a, a);
    return false;
  }
  return timingSafeEqual(a, b);
}

/**
 * POST /api/gsc/sync — aspire les données Search Console et les ARCHIVE dans
 * Firestore (un document par jour, réécrit sans risque).
 *
 * Par défaut : J-4 → J-2 (GSC publie avec ~2 jours de retard). Backfill :
 * `?start=YYYY-MM-DD&end=YYYY-MM-DD` (max 550 jours — assez pour rapatrier
 * les 16 mois que Google conserve).
 *
 * Auth : en-tête `X-Cron-Token` == GSC_CRON_TOKEN (Cloud Scheduler), sinon
 * session gestionnaire+ (déclenchement manuel).
 */
export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  let dates: string[];
  try {
    dates = start || end ? listDates(start ?? "", end ?? start ?? "") : defaultSyncDates();
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Paramètres invalides.", code: "bad_range" },
      { status: 400 }
    );
  }

  const cronToken = req.headers.get(CRON_HEADER);

  // ── Voie 1 : cron ────────────────────────────────────────────
  if (cronToken) {
    const expected = process.env.GSC_CRON_TOKEN;
    if (!expected) {
      return NextResponse.json(
        { error: "Synchronisation non configurée (GSC_CRON_TOKEN absent).", code: "not_configured" },
        { status: 503 }
      );
    }
    if (!tokensMatch(cronToken, expected)) {
      return NextResponse.json({ error: "Jeton cron invalide.", code: "unauthorized" }, { status: 401 });
    }
    return runSync(dates, null);
  }

  // ── Voie 2 : session gestionnaire+ (manuel) ──────────────────
  try {
    const session = await requireWrite();
    return await runSync(dates, session);
  } catch (error) {
    return handleError(error, "POST /api/gsc/sync");
  }
}

async function runSync(
  dates: string[],
  session: Awaited<ReturnType<typeof requireWrite>> | null
): Promise<NextResponse> {
  try {
    const summary = await syncDates(dates);
    if (session) {
      await recordAudit(session, "gsc.sync.run", `gsc/${summary.siteUrl}`, {
        days: dates.length,
        clicks: summary.totalClicks,
        impressions: summary.totalImpressions,
      });
    }
    return NextResponse.json({ ok: true, via: session ? "session" : "cron", ...summary });
  } catch (error) {
    if (error instanceof GscApiError && error.status === 403) {
      // Auto-diagnostic : la cause de loin la plus probable est que le compte
      // de service d'exécution n'a pas encore été ajouté dans la propriété GSC.
      return NextResponse.json(
        {
          error: error.message,
          code: "gsc_forbidden",
          hint:
            "Ajouter le compte de service d'exécution Cloud Run comme utilisateur " +
            "de la propriété dans Search Console (Paramètres → Utilisateurs et autorisations), " +
            "ou corriger GSC_SITE_URL.",
          accessibleSites: error.accessibleSites ?? [],
        },
        { status: 502 }
      );
    }
    return handleError(error, "POST /api/gsc/sync");
  }
}
