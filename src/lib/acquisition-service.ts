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
  lastNDaysUtc,
  type AcquisitionReport,
  type PageInput,
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
  period: AcquisitionPeriod;
}

export async function buildAcquisition(period: AcquisitionPeriod): Promise<AcquisitionResult> {
  const days = lastNDaysUtc(period);
  const col = adminDb().collection("site_traffic");

  let sources: TrafficSourceInput[] = [];
  let pages: PageInput[] = [];

  try {
    // Lecture par identifiant connu, jamais par `where` — même parti pris que
    // ceo-analysis-service.ts. Une sous-collection absente rend un instantané
    // vide, pas une erreur : les jours antérieurs au branchement de la mesure
    // n'existent tout simplement pas.
    const perDay = await Promise.all(
      days.map(async (date) => {
        const dayRef = col.doc(`day_${date}`);
        const [sourcesSnap, pagesSnap] = await Promise.all([
          dayRef.collection("sources").get(),
          dayRef.collection("pages").get(),
        ]);
        return {
          sources: sourcesSnap.docs.map(
            (d) => ({ ...(d.data() as object), date }) as TrafficSourceInput
          ),
          pages: pagesSnap.docs.map((d) => d.data() as PageInput),
        };
      })
    );

    sources = perDay.flatMap((d) => d.sources);

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
    ...buildAcquisitionReport({ trafficSources: sources, pages, days }),
    generatedAt: new Date().toISOString(),
    period,
  };
}
