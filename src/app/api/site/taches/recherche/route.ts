import { NextRequest, NextResponse } from "next/server";
import { requireRead } from "@/lib/auth-server";
import { reponseErreur } from "@/lib/erreur-metier";
import { chercherTachesHub, HubRefus } from "@/lib/taches-hub";

export const runtime = "nodejs";

/**
 * GET /api/site/taches/recherche?q=… — « Relier une tâche existante » dans
 * « Demander une page ». La recherche part au nom de LA PERSONNE CONNECTÉE
 * (son uid, son courriel), jamais d'un compte de service qui verrait des
 * tâches qu'elle n'a pas le droit de voir.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requireRead();
    const q = req.nextUrl.searchParams.get("q") || "";
    const items = await chercherTachesHub({ uid: session.uid, email: session.email }, q);
    return NextResponse.json({ items });
  } catch (error) {
    if (error instanceof HubRefus) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.status });
    }
    return reponseErreur(error, "GET /api/site/taches/recherche");
  }
}
