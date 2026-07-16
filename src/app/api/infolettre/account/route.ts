import { NextResponse } from "next/server";
import { requireRead } from "@/lib/auth-server";
import { handleError } from "@/lib/products-service";
import { getBleuhAccount } from "@/lib/mailerlite-bleuh";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/infolettre/account → infos du compte Bleuh (clé masquée, count).
// Fonctionne même non configuré (configured:false). Jamais la clé brute.
export async function GET() {
  try {
    await requireRead();
    const account = await getBleuhAccount();
    return NextResponse.json(account);
  } catch (error) {
    return handleError(error, "GET /api/infolettre/account");
  }
}
