import { NextRequest, NextResponse } from "next/server";
import { requireWrite } from "@/lib/auth-server";
import { reponseErreur } from "@/lib/erreur-metier";
import { getBleuhClient } from "@/lib/mailerlite-bleuh";
import { supprimerBrouillon } from "@/lib/campagnes-brouillons-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// DELETE /api/infolettre/brouillons/:id → supprime un BROUILLON MailerLite
// (lot L12). Une campagne programmée ou envoyée est refusée (409).
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireWrite();
    const client = getBleuhClient();
    if (!client) {
      return NextResponse.json(
        { success: false, message: "MailerLite Bleuh non configuré.", code: "not_configured" },
        { status: 503 }
      );
    }
    const { id } = await params;
    await supprimerBrouillon(client, id, session);
    return NextResponse.json({ success: true });
  } catch (error) {
    return reponseErreur(error, "DELETE /api/infolettre/brouillons/[id]");
  }
}
