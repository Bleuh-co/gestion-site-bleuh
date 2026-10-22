import { NextResponse } from "next/server";
import { ValidationError } from "./products-service";

/**
 * Erreur métier à statut, et sa traduction en réponse HTTP — pour les routes
 * des pages d'atterrissage et des infolettres (plan « Pages d'atterrissage et
 * infolettres », 22/10/2026, lot L9).
 *
 * Porté de `ShopStoreError` / `shopErrorResponse` de marketing-mdh
 * (src/lib/shop-store.ts) : un magasin lève `new ErreurMetier("…", 409)`, la
 * route n'a qu'un `catch` qui rend le bon code — 404 introuvable, 409 conflit
 * (adresse déjà prise, verrou), 501 configuration absente. La forme de la
 * réponse est celle de Marketing MDH, `{ success: false, message }`, pour que
 * les écrans portés de là-bas lisent les erreurs sans retouche.
 */
export class ErreurMetier extends Error {
  status: number;
  /**
   * Ce que la réponse porte EN PLUS du message : un `code` que l'écran peut
   * reconnaître, et les valeurs qui vont avec.
   */
  extra?: Record<string, unknown>;
  constructor(message: string, status = 500, extra?: Record<string, unknown>) {
    super(message);
    this.name = "ErreurMetier";
    this.status = status;
    this.extra = extra;
  }
}

/**
 * UNAUTHORIZED→401, FORBIDDEN→403 (requireRead/requireWrite), ErreurMetier→son
 * statut, ValidationError (produits, images)→400, tout le reste→500 sans la
 * trace : le détail part au journal, pas à l'écran.
 */
export function reponseErreur(error: unknown, contexte: string): NextResponse {
  if (error instanceof Error && error.message === "UNAUTHORIZED") {
    return NextResponse.json({ success: false, message: "Non authentifié." }, { status: 401 });
  }
  if (error instanceof Error && error.message === "FORBIDDEN") {
    return NextResponse.json({ success: false, message: "Accès refusé." }, { status: 403 });
  }
  if (error instanceof ErreurMetier) {
    return NextResponse.json({ success: false, message: error.message, ...(error.extra ?? {}) }, { status: error.status });
  }
  if (error instanceof ValidationError) {
    return NextResponse.json({ success: false, message: error.message }, { status: 400 });
  }
  console.error(`${contexte} :`, error instanceof Error ? error.message : error);
  return NextResponse.json({ success: false, message: "Erreur interne. Réessayez dans un instant." }, { status: 500 });
}
