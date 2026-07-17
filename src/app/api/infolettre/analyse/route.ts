import { NextResponse } from "next/server";
import { requireWrite } from "@/lib/auth-server";
import { recordAudit } from "@/lib/audit";
import { adminDb } from "@/lib/firebase-admin";
import { handleError } from "@/lib/products-service";
import { getBleuhClient } from "@/lib/mailerlite-bleuh";
import { summarizeHtml, type HtmlSummary } from "@/lib/infolettre-content";
import {
  METRICS_COLLECTION,
  CAMPAIGN_STATS_COLLECTION,
} from "@/lib/infolettre-collect";
import type {
  MetricsSnapshot,
  CampaignStatHistory,
} from "@/lib/infolettre-metrics-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Bornes de coût/tokens : on n'analyse qu'un petit nombre de campagnes et on
// ne transmet à l'IA qu'un extrait de texte, jamais le HTML brut massif.
const MAX_DIAGNOSE = 5;
const MIN_DIAGNOSE = 3;
const AI_TEXT_CHARS = 1200; // extrait envoyé à l'IA par campagne

interface CampaignRow {
  id: string;
  name: string;
  subject: string;
  dateSend: string; // ISO
  recipients: number;
  openRate: number;
  clickRate: number;
}

interface Diagnostic {
  campaign: string;
  subject: string;
  opened: number; // taux d'ouverture %
  why: string | null;
  recommandations: string[];
}

interface AnalyseResponse {
  summary: string | null;
  insights: string[];
  diagnostics: Diagnostic[];
  meta: {
    generatedAt: string;
    model: string;
    weightedMeanOpenRate: number;
    campaignsAnalyzed: number;
    aiAvailable: boolean;
  };
}

function parseDateSend(s: string): Date | null {
  if (!s) return null;
  const d = new Date(s.includes("T") ? s : s.replace(" ", "T"));
  return isNaN(d.getTime()) ? null : d;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Moyenne d'ouverture pondérée par destinataires sur un ensemble d'envois. */
function weightedMeanOpen(rows: CampaignRow[]): number {
  let num = 0;
  let den = 0;
  for (const r of rows) {
    num += r.openRate * r.recipients;
    den += r.recipients;
  }
  return den > 0 ? num / den : 0;
}

const SYSTEM_PROMPT = `Tu es un analyste marketing qui diagnostique la performance des infolettres de Bleuh (marque de produits de cannabis vendus via les détaillants provinciaux SQDC/OCS).
Ta mission : (1) résumer les tendances marketing de la liste et des campagnes, (2) pour chaque campagne sous-performante fournie, DIAGNOSTIQUER des causes plausibles à partir de son CONTENU (sujet peu incitatif, aperçu absent, CTA absent ou enfoui en bas, email trop long, trop d'images, texte pauvre, etc.) et proposer des recommandations concrètes.
Règles strictes :
- Angle MARKETING uniquement (objet, aperçu, CTA, structure, longueur, cadence). AUCUNE allégation de santé ni aucun propos sur les effets/vertus du cannabis ou du chanvre.
- Reste factuel. N'invente AUCUN chiffre : les taux te sont fournis, ne les modifie pas et n'en crée pas d'autres.
- Base tes diagnostics sur les signaux de contenu fournis (titre, aperçu, nombre de liens/images, CTA et son emplacement, longueur, extrait de texte). Formule des causes « plausibles », sans certitude excessive.
- Réponds STRICTEMENT en JSON valide, sans texte autour, au format :
{"summary":"…","insights":["…"],"diagnostics":[{"index":0,"why":"…","recommandations":["…","…"]}]}
- "summary" : 2-3 phrases sur les tendances (croissance de la liste, ouverture/clic). "insights" : 3-5 puces marketing actionnables. "diagnostics" : un objet par campagne fournie, "index" = l'index fourni, "why" = causes plausibles issues du contenu, "recommandations" = 2-3 actions concrètes.
- Rédige en français.`;

interface AiDiag {
  index: number;
  why?: string;
  recommandations?: string[];
}
interface AiPayload {
  summary?: string;
  insights?: string[];
  diagnostics?: AiDiag[];
}

/** Extrait le 1er objet JSON d'une réponse texte (tolère les ```json). */
function parseAiJson(text: string): AiPayload | null {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as AiPayload;
  } catch {
    return null;
  }
}

// POST /api/infolettre/analyse — analyse IA des tendances + diagnostic contenu.
// requireWrite (coûte des tokens) + audit. Clés ML/Anthropic jamais exposées.
export async function POST() {
  let session;
  try {
    session = await requireWrite();
  } catch (error) {
    return handleError(error, "POST /api/infolettre/analyse (auth)");
  }

  try {
    const client = getBleuhClient();
    if (!client) {
      return NextResponse.json(
        { error: "MailerLite non configuré.", code: "not_configured" },
        { status: 503 }
      );
    }

    const db = adminDb();
    const [metricsSnap, statsSnap] = await Promise.all([
      db.collection(METRICS_COLLECTION).orderBy("capturedAt", "asc").get(),
      db.collection(CAMPAIGN_STATS_COLLECTION).get(),
    ]);

    // ── Tendance santé de liste ───────────────────────────────
    const snapshots = metricsSnap.docs.map((d) => d.data() as MetricsSnapshot);
    const firstSnap = snapshots[0];
    const lastSnap = snapshots[snapshots.length - 1];
    const listGrowth =
      firstSnap && lastSnap
        ? {
            depuis: firstSnap.capturedAt,
            actifsDebut: firstSnap.subscribers?.active ?? 0,
            actifsFin: lastSnap.subscribers?.active ?? 0,
            delta:
              (lastSnap.subscribers?.active ?? 0) - (firstSnap.subscribers?.active ?? 0),
          }
        : null;

    // ── Campagnes (dernier point d'history = stats finales) ───
    const rows: CampaignRow[] = [];
    for (const doc of statsSnap.docs) {
      const c = doc.data() as CampaignStatHistory;
      const d = parseDateSend(c.dateSend);
      if (!d) continue;
      const final = c.history?.[c.history.length - 1];
      rows.push({
        id: c.campaignId || doc.id,
        name: c.name || c.subject || c.campaignId || doc.id,
        subject: c.subject || "",
        dateSend: d.toISOString(),
        recipients: c.recipients ?? 0,
        openRate: final?.openRate ?? 0,
        clickRate: final?.clickRate ?? 0,
      });
    }
    rows.sort((a, b) => a.dateSend.localeCompare(b.dateSend));

    // Base statistique : campagnes à volume significatif, sinon toutes.
    const sizable = rows.filter((r) => r.recipients >= 100);
    const base = sizable.length >= MAX_DIAGNOSE ? sizable : rows.filter((r) => r.recipients > 0);
    const mean = weightedMeanOpen(base);

    // Meilleures / pires (pour la synthèse).
    const byOpen = [...base].sort((a, b) => b.openRate - a.openRate);
    const best = byOpen.slice(0, 3).map((r) => ({ nom: r.name, ouverture: round1(r.openRate) }));
    const worst = byOpen
      .slice(-3)
      .reverse()
      .map((r) => ({ nom: r.name, ouverture: round1(r.openRate) }));

    // ── Sous-performantes : « nettement » sous la moyenne pondérée ──
    let under = base
      .filter((r) => r.openRate < mean * 0.85)
      .sort((a, b) => a.openRate - b.openRate);
    if (under.length < MIN_DIAGNOSE) {
      under = base.filter((r) => r.openRate < mean).sort((a, b) => a.openRate - b.openRate);
    }
    under = under.slice(0, MAX_DIAGNOSE);

    // ── Résumé de contenu par sous-performante (borné, best-effort) ──
    const enriched: { row: CampaignRow; summary: HtmlSummary | null }[] = await Promise.all(
      under.map(async (row) => {
        try {
          const html = await client.getCampaignContent(row.id);
          return { row, summary: summarizeHtml(html) };
        } catch (e) {
          console.warn(`[infolettre/analyse] contenu ${row.id} illisible :`, e);
          return { row, summary: null };
        }
      })
    );

    // Diagnostics déterministes (nom + taux réels) ; l'IA remplit why/reco.
    const diagnostics: Diagnostic[] = enriched.map(({ row }) => ({
      campaign: row.name,
      subject: row.subject,
      opened: round1(row.openRate),
      why: null,
      recommandations: [],
    }));

    // ── Appel IA (même mécanisme que le module CEO) ───────────
    const apiKey = process.env.ANTHROPIC_API_KEY;
    let summary: string | null = null;
    let insights: string[] = [];
    let aiAvailable = false;

    if (apiKey && enriched.length > 0) {
      try {
        const { default: Anthropic } = await import("@anthropic-ai/sdk");
        const anthropic = new Anthropic({ apiKey });

        const userPayload = {
          tendances: {
            croissanceListe: listGrowth ?? "historique insuffisant",
            tauxOuvertureMoyenPondere: round1(mean),
            nbCampagnes: rows.length,
            meilleures: best,
            pires: worst,
          },
          sousPerformantes: enriched.map(({ row, summary: s }, index) => ({
            index,
            nom: row.name,
            objet: row.subject,
            tauxOuverture: round1(row.openRate),
            tauxClic: round1(row.clickRate),
            ecartVsMoyenne: round1(row.openRate - mean),
            destinataires: row.recipients,
            contenu: s
              ? {
                  titre: s.title,
                  apercu: s.preview,
                  nbMots: s.wordCount,
                  nbLiens: s.linkCount,
                  nbImages: s.imageCount,
                  cta: s.cta,
                  extrait: s.textExcerpt.slice(0, AI_TEXT_CHARS),
                }
              : "contenu indisponible",
          })),
        };

        const response = await anthropic.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 4096, // éviter le tronquage du JSON (summary + diagnostics)
          system: SYSTEM_PROMPT,
          messages: [
            {
              role: "user",
              content: `Analyse ces tendances marketing et diagnostique les campagnes sous-performantes à partir de leur contenu :\n${JSON.stringify(userPayload, null, 2)}`,
            },
          ],
        });

        const text = response.content
          .filter((b): b is { type: "text"; text: string } => b.type === "text")
          .map((b) => b.text)
          .join("\n")
          .trim();

        const parsed = parseAiJson(text);
        if (parsed) {
          aiAvailable = true;
          summary = typeof parsed.summary === "string" ? parsed.summary : null;
          insights = Array.isArray(parsed.insights)
            ? parsed.insights.filter((x): x is string => typeof x === "string")
            : [];
          for (const d of parsed.diagnostics ?? []) {
            if (typeof d?.index !== "number" || !diagnostics[d.index]) continue;
            diagnostics[d.index].why = typeof d.why === "string" ? d.why : null;
            diagnostics[d.index].recommandations = Array.isArray(d.recommandations)
              ? d.recommandations.filter((x): x is string => typeof x === "string")
              : [];
          }
        }
      } catch (e) {
        console.warn("[infolettre/analyse] appel Anthropic échoué :", e);
      }
    }

    await recordAudit(session, "infolettre.analyse.run", "infolettre", {
      campaignsAnalyzed: enriched.length,
      aiAvailable,
    });

    const body: AnalyseResponse = {
      summary,
      insights,
      diagnostics,
      meta: {
        generatedAt: new Date().toISOString(),
        model: "claude-sonnet-4-6",
        weightedMeanOpenRate: round1(mean),
        campaignsAnalyzed: enriched.length,
        aiAvailable,
      },
    };
    return NextResponse.json(body);
  } catch (error) {
    return handleError(error, "POST /api/infolettre/analyse");
  }
}
