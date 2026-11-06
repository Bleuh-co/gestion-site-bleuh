import "server-only";
import { timingSafeEqual } from "node:crypto";

/** En-tête posé par Cloud Scheduler sur les routes de Search Console. */
export const CRON_HEADER = "x-cron-token";

/** Comparaison à temps constant (même contrat que /api/infolettre/collect). */
export function tokensMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    timingSafeEqual(a, a);
    return false;
  }
  return timingSafeEqual(a, b);
}
