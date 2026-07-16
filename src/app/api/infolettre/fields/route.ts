import { NextResponse } from "next/server";
import { requireRead } from "@/lib/auth-server";
import { handleError } from "@/lib/products-service";
import { getBleuhClient } from "@/lib/mailerlite-bleuh";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/infolettre/fields → champs personnalisés LIVE du compte Bleuh. requireRead.
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
    const fields = await client.getFields();
    return NextResponse.json(fields);
  } catch (error) {
    return handleError(error, "GET /api/infolettre/fields");
  }
}
