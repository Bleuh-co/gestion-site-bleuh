import { NextResponse } from "next/server";
import { requireRead } from "@/lib/auth-server";
import { reponseErreur } from "@/lib/erreur-metier";
import { getBleuhClient } from "@/lib/mailerlite-bleuh";
import { listerNonEnvoyees } from "@/lib/campagnes-brouillons-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/infolettre/brouillons → les campagnes MailerLite pas encore
// parties (brouillons, envois programmés), avec leur discussion (lot L12).
export async function GET() {
  try {
    const session = await requireRead();
    const client = getBleuhClient();
    if (!client) {
      return NextResponse.json(
        { success: false, message: "MailerLite Bleuh non configuré.", code: "not_configured" },
        { status: 503 }
      );
    }
    const campagnes = await listerNonEnvoyees(client, session.email);
    return NextResponse.json({ success: true, campagnes });
  } catch (error) {
    return reponseErreur(error, "GET /api/infolettre/brouillons");
  }
}
