import { NextResponse } from "next/server";
import { requireRead } from "@/lib/auth-server";
import { handleError } from "@/lib/products-service";
import { getBleuhClient } from "@/lib/mailerlite-bleuh";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/infolettre/groups → groupes LIVE du compte Bleuh. requireRead.
export async function GET() {
  try {
    await requireRead();
    const client = getBleuhClient();
    if (!client) {
      return NextResponse.json(
        { error: "MailerLite Bleuh non configuré.", code: "not_configured" },
        { status: 503 }
      );
    }
    const groups = await client.getGroups();
    return NextResponse.json(groups);
  } catch (error) {
    return handleError(error, "GET /api/infolettre/groups");
  }
}
