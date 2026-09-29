import type { Campaign, CampaignsSummary } from "./infolettre-types";

/** Période inclusive en jours "YYYY-MM-DD" ; une borne absente = ouverte. */
export interface DayRange {
  from?: string;
  to?: string;
}

/** Jour "YYYY-MM-DD" d'une date ML ("YYYY-MM-DD HH:MM:SS" ou ISO). */
export function dayOf(s: string): string {
  return (s || "").slice(0, 10);
}

export function inRange(s: string, range: DayRange): boolean {
  const day = dayOf(s);
  if (!day) return false;
  if (range.from && day < range.from) return false;
  if (range.to && day > range.to) return false;
  return true;
}

/**
 * Résumé des campagnes d'une période. Taux pondérés : somme(opens)/somme(dest.).
 *
 * L'API ML Classic v2 ne donne pas les désabonnements par campagne : on compte
 * les désabonnements DATÉS dans la période, rapportés aux destinataires des
 * campagnes envoyées dans cette même période (définition MailerLite du taux).
 */
export function summarizeCampaigns(
  campaigns: Campaign[],
  unsubscribeDates: string[],
  range: DayRange = {}
): { summary: CampaignsSummary; campaigns: Campaign[] } {
  const rows = campaigns.filter((c) => inRange(c.dateSend, range));

  let totalRecipients = 0;
  let totalOpens = 0;
  let totalClicks = 0;
  for (const c of rows) {
    totalRecipients += c.recipients;
    totalOpens += c.openCount;
    totalClicks += c.clickCount;
  }
  const unsubscribes = unsubscribeDates.filter((d) => inRange(d, range)).length;

  const pct = (n: number) => (totalRecipients > 0 ? (n / totalRecipients) * 100 : 0);
  return {
    campaigns: rows,
    summary: {
      campaigns: rows.length,
      totalRecipients,
      avgOpenRate: pct(totalOpens),
      avgClickRate: pct(totalClicks),
      unsubscribes,
      unsubscribeRate: pct(unsubscribes),
    },
  };
}
