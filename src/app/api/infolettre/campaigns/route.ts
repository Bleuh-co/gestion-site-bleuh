import { NextRequest, NextResponse } from "next/server";
import { requireRead } from "@/lib/auth-server";
import { handleError } from "@/lib/products-service";
import { getBleuhClient } from "@/lib/mailerlite-bleuh";
import type { Campaign, CampaignsResponse } from "@/lib/infolettre-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/infolettre/campaigns → campagnes envoyées LIVE + résumé agrégé.
// Stats agrégées, aucune PII → requireRead suffit.
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
    const campaigns: Campaign[] = await client.getAllSentCampaigns();

    // Taux pondérés sur le set DÉDUPLIQUÉ : somme(opens)/somme(dest.).
    let totalRecipients = 0;
    let totalOpens = 0;
    let totalClicks = 0;
    for (const c of campaigns) {
      totalRecipients += c.recipients;
      totalOpens += c.openCount;
      totalClicks += c.clickCount;
    }

    const summary: CampaignsResponse["summary"] = {
      campaigns: campaigns.length,
      totalRecipients,
      avgOpenRate: totalRecipients > 0 ? (totalOpens / totalRecipients) * 100 : 0,
      avgClickRate: totalRecipients > 0 ? (totalClicks / totalRecipients) * 100 : 0,
    };

    const body: CampaignsResponse = { summary, campaigns };
    return NextResponse.json(body);
  } catch (error) {
    return handleError(error, "GET /api/infolettre/campaigns");
  }
}
