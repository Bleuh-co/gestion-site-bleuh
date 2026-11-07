import "server-only";
import { timingSafeEqual } from "node:crypto";

const HEADER = "x-publicite-ingest-key";

/**
 * Jeton de service STUDIO → MARKETING BLEUH (lot L5, plan publicite-bdion,
 * 06-07/11/2026) : Studio Chanv (lot L9, pas encore construit) lira ici les
 * totaux de clics vers un détaillant par campagne, pour son tableau des deux
 * marques. Studio n'a aucune session gestion-site-bleuh : `requireRead`
 * (auth-server.ts) ne peut pas s'appliquer à cet appel.
 *
 * Même patron que `STUDIO_INGEST_KEY` (studio-chanv, middleware/auth.js,
 * fonction `isGandalfBridge`), en sens inverse : ici c'est l'APPELANT qui
 * doit nous prouver son identité, par un en-tête comparé en temps constant.
 * Route dédiée (jamais `/api/acquisition`, qui reste réservée aux sessions
 * humaines) : aucun risque de mélanger les deux façons de s'authentifier.
 */
export function hasPubliciteIngestKey(req: Request): boolean {
  const key = process.env.PUBLICITE_INGEST_KEY || "";
  const given = req.headers.get(HEADER) || "";
  if (!key || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(key);
  return a.length === b.length && timingSafeEqual(a, b);
}
