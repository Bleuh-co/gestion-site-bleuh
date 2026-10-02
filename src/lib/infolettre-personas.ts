/**
 * Répartition des abonnés actifs par persona (champ MailerLite « Persona »,
 * clé `persona`) — demandée par Daphnée Paquette le 2026-10-02.
 *
 * Le formulaire d'infolettre de bleuh.co (pop-up et bas de l'accueil) demande
 * « Qu’est-ce qui vous amène chez Bleuh? » et enregistre Consumer, Budtender
 * ou Retailer dans ce champ (site-bleuh, src/lib/newsletter-persona-pure.ts).
 * Les abonnés d'avant le 2026-10-02 et ceux du pop-up MailerLite hors Québec
 * n'ont pas de persona.
 *
 * Module sans import : testable directement par `node --test`.
 */

export const PERSONA_FIELD_KEY = "persona";

export const PERSONAS = [
  { value: "Consumer", label: "Je découvre Bleuh pour moi" },
  { value: "Budtender", label: "J’aide les clients à choisir des produits en magasin" },
  { value: "Retailer", label: "Je choisis ou commande les produits pour mon magasin" },
] as const;

export type PersonaValue = (typeof PERSONAS)[number]["value"];

export interface PersonaBreakdown {
  Consumer: number;
  Budtender: number;
  Retailer: number;
  /** Rempli, mais pas l'une des trois valeurs (saisie à la main, import…). */
  other: number;
  /** Champ vide. */
  none: number;
}

/** Compte les valeurs du champ persona, sans tenir compte de la casse. */
export function tallyPersonas(values: Iterable<string | null | undefined>): PersonaBreakdown {
  const out: PersonaBreakdown = { Consumer: 0, Budtender: 0, Retailer: 0, other: 0, none: 0 };
  for (const raw of values) {
    const v = (raw ?? "").trim().toLowerCase();
    if (!v) {
      out.none += 1;
      continue;
    }
    const persona = PERSONAS.find((p) => p.value.toLowerCase() === v);
    if (persona) out[persona.value] += 1;
    else out.other += 1;
  }
  return out;
}
