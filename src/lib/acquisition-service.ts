import "server-only";

/**
 * Acquisition — lectures Firestore. Toute la logique vit dans
 * `acquisition-pure.ts` ; ce module ne fait que rapatrier les documents.
 *
 * Source unique : `site_traffic/day_YYYY-MM-DD` et ses deux sous-collections
 * (`sources`, `pages`), écrites par le storefront site-bleuh
 * (`src/app/api/track/route.ts`). Même projet GCP des deux côtés — antigravity
 * en prod, gandalf-dev en dev — donc adminDb() lit bien ce que le site écrit.
 *
 * Il n'y a PAS de source de ventes ici, et ce n'est pas un oubli : bleuh.co ne
 * vend rien (voir l'en-tête de acquisition-pure.ts).
 */

import { adminDb } from "@/lib/firebase-admin";
import {
  buildAcquisitionReport,
  daysBetweenUtc,
  lastNDaysUtc,
  type AcquisitionReport,
  type FrictionInput,
  type PageInput,
  type RetailerClickInput,
  type TrafficSourceInput,
} from "@/lib/acquisition-pure";

export const ACQUISITION_PERIODS = [7, 30, 90] as const;
export type AcquisitionPeriod = (typeof ACQUISITION_PERIODS)[number];

export function parsePeriod(raw: unknown): AcquisitionPeriod {
  const n = Number(raw);
  return (ACQUISITION_PERIODS as readonly number[]).includes(n) ? (n as AcquisitionPeriod) : 30;
}

export interface AcquisitionResult extends AcquisitionReport {
  generatedAt: string;
  /** `period` fixe (7/30/90), ou le nombre de jours d'une plage libre (lot L9, `buildAcquisitionRange`). */
  period: number;
}

export async function buildAcquisition(period: AcquisitionPeriod): Promise<AcquisitionResult> {
  return buildAcquisitionPourJours(lastNDaysUtc(period), period);
}

/**
 * Même rapport, sur une plage libre `du`–`au` (jours UTC inclus) plutôt qu'un
 * raccourci `period` — lot L9 (plan publicite-bdion) : l'onglet Chiffres de
 * Studio propose « Hier » et une période libre, que `ACQUISITION_PERIODS` ne
 * couvre pas. `null` si la plage est invalide (voir `daysBetweenUtc`).
 */
export async function buildAcquisitionRange(du: string, au: string, maintenant: Date = new Date()): Promise<AcquisitionResult | null> {
  const days = daysBetweenUtc(du, au, maintenant);
  if (!days) return null;
  return buildAcquisitionPourJours(days, days.length);
}

async function buildAcquisitionPourJours(days: string[], periodLabel: number): Promise<AcquisitionResult> {
  const col = adminDb().collection("site_traffic");

  let sources: TrafficSourceInput[] = [];
  let pages: PageInput[] = [];
  let frictions: FrictionInput[] = [];
  let retailerClicks: RetailerClickInput[] = [];

  try {
    // Lecture par identifiant connu, jamais par `where` — même parti pris que
    // ceo-analysis-service.ts. Une sous-collection absente rend un instantané
    // vide, pas une erreur : les jours antérieurs au branchement de la mesure
    // n'existent tout simplement pas.
    const perDay = await Promise.all(
      days.map(async (date) => {
        const dayRef = col.doc(`day_${date}`);
        const [sourcesSnap, pagesSnap, frictionsSnap, retailerClicksSnap] = await Promise.all([
          dayRef.collection("sources").get(),
          dayRef.collection("pages").get(),
          dayRef.collection("frictions").get(),
          // Lot L5 (plan publicite-bdion) : les cinq chemins vers un détaillant.
          dayRef.collection("retailer_clicks").get(),
        ]);
        return {
          sources: sourcesSnap.docs.map(
            (d) => ({ ...(d.data() as object), date }) as TrafficSourceInput
          ),
          pages: pagesSnap.docs.map((d) => d.data() as PageInput),
          // L'identifiant du document EST la signature (type+page+libelle+
          // statut, recalculée côté serveur par site-bleuh) : c'est lui qui
          // permet de recoller la même friction d'un jour à l'autre.
          frictions: frictionsSnap.docs.map(
            (d) => ({ id: d.id, ...(d.data() as object), date }) as FrictionInput
          ),
          // Même principe : l'identifiant du document EST la combinaison
          // chemin×zone×campagne×création×produit (site-bleuh, retailerClickDocId).
          retailerClicks: retailerClicksSnap.docs.map(
            (d) => ({ id: d.id, ...(d.data() as object), date }) as RetailerClickInput
          ),
        };
      })
    );

    sources = perDay.flatMap((d) => d.sources);
    frictions = perDay.flatMap((d) => d.frictions);
    retailerClicks = perDay.flatMap((d) => d.retailerClicks);

    // Un même chemin a un document PAR JOUR : on les recolle par chemin.
    const byPath = new Map<string, { path: string; views: number; engagedViews: number; engagementMs: number }>();
    for (const { pages: dayPages } of perDay) {
      for (const p of dayPages) {
        const path = typeof p.path === "string" ? p.path : "—";
        const prev = byPath.get(path);
        const views = Number(p.views) || 0;
        const engagedViews = Number(p.engagedViews) || 0;
        const engagementMs = Number(p.engagementMs) || 0;
        if (prev) {
          prev.views += views;
          prev.engagedViews += engagedViews;
          prev.engagementMs += engagementMs;
        } else {
          byPath.set(path, { path, views, engagedViews, engagementMs });
        }
      }
    }
    pages = [...byPath.values()];
  } catch (e) {
    // La mesure d'audience ne doit jamais faire échouer l'écran : on rend un
    // rapport vide, que l'interface présente comme « en attente ».
    console.warn("[acquisition] lecture site_traffic échouée :", e);
  }

  return {
    ...buildAcquisitionReport({ trafficSources: sources, pages, frictions, retailerClicks, days }),
    generatedAt: new Date().toISOString(),
    period: periodLabel,
  };
}
