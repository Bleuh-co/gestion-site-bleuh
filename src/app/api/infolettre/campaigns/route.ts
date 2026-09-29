import { NextRequest, NextResponse } from "next/server";
import { requireRead } from "@/lib/auth-server";
import { handleError } from "@/lib/products-service";
import { getBleuhClient } from "@/lib/mailerlite-bleuh";
import { summarizeCampaigns } from "@/lib/infolettre-campaigns-summary";
import type { CampaignsResponse } from "@/lib/infolettre-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/infolettre/campaigns → campagnes envoyées LIVE + résumé agrégé
// + dates des désabonnements (le filtre de période se fait à l'écran).
// Stats agrégées et dates sans identité, aucune PII → requireRead suffit.
export async function GET(_req: NextRequest) {
  try {
    await requireRead();
    const client = getBleuhClient();
    if (!client) {
      return NextResponse.json(
        { error: "MailerLite Bleuh non configuré.", code: "not_configured" },
        { status: 503 }
      );
    }

    // Liste complète, dédupliquée par id (offset + Map côté client).
    const [all, unsubscribeDates] = await Promise.all([
      client.getAllSentCampaigns(),
      client.getUnsubscribeDates(),
    ]);

    const { summary, campaigns } = summarizeCampaigns(all, unsubscribeDates);
    const body: CampaignsResponse = { summary, campaigns, unsubscribeDates };
    return NextResponse.json(body);
  } catch (error) {
    return handleError(error, "GET /api/infolettre/campaigns");
  }
}
