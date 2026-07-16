import { NextRequest, NextResponse } from "next/server";
import { requireRead } from "@/lib/auth-server";
import { handleError } from "@/lib/products-service";
import { getBleuhClient } from "@/lib/mailerlite-bleuh";
import type { SubscriberStatus } from "@/lib/infolettre-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/infolettre/subscribers → abonnés LIVE paginés (proxy ML Bleuh).
// Pagination cursor=offset. requireRead.
export async function GET(req: NextRequest) {
  try {
    await requireRead();
    const client = getBleuhClient();
    if (!client) {
      return NextResponse.json(
        { error: "MailerLite Bleuh non configuré.", code: "not_configured" },
        { status: 503 }
      );
    }

    const sp = req.nextUrl.searchParams;
    const cursor = sp.get("cursor") || undefined;
    const limit = Math.min(parseInt(sp.get("limit") || "50", 10), 100);
    const search = sp.get("search") || undefined;
    const status = (sp.get("status") || undefined) as SubscriberStatus | undefined;

    const result = await client.getSubscribers({ cursor, limit, search, status });
    return NextResponse.json(result);
  } catch (error) {
    return handleError(error, "GET /api/infolettre/subscribers");
  }
}
