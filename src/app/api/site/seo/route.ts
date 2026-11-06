import { NextResponse } from "next/server";
import { requireRead } from "@/lib/auth-server";
import { reponseErreur } from "@/lib/erreur-metier";
import { baseBleuhCo, pagesDeBleuhCo } from "@/lib/bleuh-co-en-ligne";
import { listerReglages } from "@/lib/seo-reglages-store";

export const runtime = "nodejs";

/**
 * GET /api/site/seo — Titres et descriptions : les pages de bleuh.co (lues
 * dans son plan du site) et les réglages posés ici, par clé d'adresse.
 */
export async function GET() {
  try {
    await requireRead();
    const [{ pages, luA }, reglages] = await Promise.all([pagesDeBleuhCo(), listerReglages()]);
    return NextResponse.json({ base: baseBleuhCo(), pages, reglages, planLuLe: new Date(luA).toISOString() });
  } catch (error) {
    return reponseErreur(error, "GET /api/site/seo");
  }
}
