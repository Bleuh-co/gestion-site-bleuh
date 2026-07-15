"use client";

import { useEffect, useState } from "react";
import type { Role } from "@/lib/types";

type Period = "7d" | "30d" | "90d";

interface DailyPoint {
  date: string;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  costCad: number;
}

interface CeoKpis {
  period: Period;
  days: number;
  model: string;
  interactions: { total: number; byDay: DailyPoint[] };
  cost: { totalCad: number; label: string };
  sessions: { total: number; escalated: number; escalationRate: number | null };
}

type Ga4Traffic =
  | { status: "ok"; sessions: number; activeUsers: number; screenPageViews: number }
  | { status: "non_instrumente" };

interface CeoAnalysisResult {
  generatedAt: string;
  period: Period;
  kpis: CeoKpis;
  sources: { ga4: Ga4Traffic; ventes: "non_instrumente" };
  aiSummary: string | null;
}

interface DeepAnalysisResult {
  generatedAt: string;
  period: Period;
  model: string;
  kpis: CeoKpis;
  insights: string | null;
}

interface AnalyseCeoClientProps {
  role: Role;
}

const PERIOD_LABELS: Record<Period, string> = { "7d": "7 jours", "30d": "30 jours", "90d": "90 jours" };

const nombreFmt = new Intl.NumberFormat("fr-CA");
const cadFmt = new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 2 });
const pctFmt = new Intl.NumberFormat("fr-CA", { style: "percent", maximumFractionDigits: 1 });

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card p-4">
      <p className="label mb-1">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs text-chanv-terre/60 mt-1">{sub}</p>}
    </div>
  );
}

export function AnalyseCeoClient({ role }: AnalyseCeoClientProps) {
  const canRunDeepAnalysis = role === "gestionnaire" || role === "admin" || role === "superadmin";

  const [period, setPeriod] = useState<Period>("7d");
  const [data, setData] = useState<CeoAnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [deepResult, setDeepResult] = useState<DeepAnalysisResult | null>(null);
  const [deepLoading, setDeepLoading] = useState(false);
  const [deepError, setDeepError] = useState<string | null>(null);

  useEffect(() => {
    // Réinitialise l'analyse approfondie affichée quand la période change —
    // elle correspondait à l'ancienne fenêtre.
    setDeepResult(null);
    setDeepError(null);
  }, [period]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/analyse-ceo?period=${period}`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `Erreur ${res.status}`);
        }
        return res.json();
      })
      .then((json: CeoAnalysisResult) => {
        if (!cancelled) setData(json);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message || "Impossible de charger l'analyse CEO.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [period]);

  async function handleRunDeepAnalysis() {
    setDeepLoading(true);
    setDeepError(null);
    try {
      const res = await fetch(`/api/analyse-ceo/run?period=${period}`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Erreur ${res.status}`);
      }
      const json: DeepAnalysisResult = await res.json();
      setDeepResult(json);
    } catch (e) {
      setDeepError(e instanceof Error ? e.message : "Impossible de lancer l'analyse approfondie.");
    } finally {
      setDeepLoading(false);
    }
  }

  const kpis = data?.kpis;
  const escalationRateText =
    kpis && kpis.sessions.escalationRate !== null ? pctFmt.format(kpis.sessions.escalationRate) : "—";

  return (
    <main className="mx-auto max-w-6xl p-6">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Analyse CEO</h1>
          <p className="text-sm text-chanv-terre/70">
            KPIs réels de l&apos;assistant Bleuh (chat_usage / chat_sessions) — aucun chiffre inventé.
          </p>
        </div>
        <div className="flex gap-2">
          {(["7d", "30d", "90d"] as Period[]).map((p) => (
            <button
              key={p}
              type="button"
              className={p === period ? "btn-primary" : "btn-secondary"}
              onClick={() => setPeriod(p)}
              disabled={loading && p === period}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="card p-4 mb-6 border-l-4" style={{ borderLeftColor: "var(--color-danger)" }}>
          <p className="text-sm">{error}</p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <KpiCard
          label="Volume d'interactions"
          value={loading || !kpis ? "…" : nombreFmt.format(kpis.interactions.total)}
          sub={kpis ? `Sur ${kpis.days} jours — requêtes /chat` : undefined}
        />
        <KpiCard
          label="Coût IA estimé"
          value={loading || !kpis ? "…" : cadFmt.format(kpis.cost.totalCad)}
          sub={kpis ? `${kpis.cost.label} — modèle ${kpis.model}` : undefined}
        />
        <KpiCard
          label="Sessions"
          value={loading || !kpis ? "…" : nombreFmt.format(kpis.sessions.total)}
          sub={kpis ? `${nombreFmt.format(kpis.sessions.escalated)} escaladée(s)` : undefined}
        />
        <KpiCard
          label="Taux d'escalade"
          value={loading || !kpis ? "…" : escalationRateText}
          sub={kpis && kpis.sessions.total === 0 ? "Aucune session sur la période" : undefined}
        />
      </div>

      <section className="card p-4 mb-6">
        <h2 className="text-lg font-semibold mb-1">Synthèse IA</h2>
        {!loading && data && !data.aiSummary && (
          <p className="text-sm text-chanv-terre/70">
            Synthèse IA non disponible : ANTHROPIC_API_KEY non configurée, ou la génération a échoué.
          </p>
        )}
        {loading && <p className="text-sm text-chanv-terre/70">Chargement…</p>}
        {!loading && data?.aiSummary && (
          <div className="text-sm whitespace-pre-line leading-relaxed">{data.aiSummary}</div>
        )}
      </section>

      {canRunDeepAnalysis && (
        <section className="card p-4 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-2">
            <div>
              <h2 className="text-lg font-semibold">Analyse approfondie</h2>
              <p className="text-xs text-chanv-terre/60">
                Insights stratégiques + recommandations (modèle claude-sonnet-4-6) — consomme des tokens, à lancer
                à la demande.
              </p>
            </div>
            <button
              type="button"
              className="btn-primary"
              onClick={handleRunDeepAnalysis}
              disabled={deepLoading}
            >
              {deepLoading ? "Analyse en cours…" : "Lancer une vraie analyse"}
            </button>
          </div>
          {deepError && (
            <div className="card p-3 mt-2 border-l-4" style={{ borderLeftColor: "var(--color-danger)" }}>
              <p className="text-sm">{deepError}</p>
            </div>
          )}
          {deepResult?.insights && (
            <div className="text-sm whitespace-pre-line leading-relaxed mt-3">{deepResult.insights}</div>
          )}
          {deepResult && !deepResult.insights && !deepError && (
            <p className="text-sm text-chanv-terre/70 mt-3">
              Analyse approfondie indisponible : ANTHROPIC_API_KEY non configurée, ou la génération a échoué.
            </p>
          )}
        </section>
      )}

      <section className="card p-4">
        <h2 className="text-lg font-semibold mb-1">Sources à instrumenter</h2>
        <p className="text-sm text-chanv-terre/70 mb-3">
          Ces sources ne sont pas encore branchées à ce module — aucun chiffre n&apos;est simulé à leur place.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-center justify-between gap-3 rounded-lg border border-chanv-fibre p-3">
            <div>
              <p className="font-semibold text-sm">Trafic / clics (GA4)</p>
              {data?.sources.ga4.status === "ok" ? (
                <p className="text-xs text-chanv-terre/60">
                  {nombreFmt.format(data.sources.ga4.sessions)} sessions ·{" "}
                  {nombreFmt.format(data.sources.ga4.activeUsers)} utilisateurs actifs ·{" "}
                  {nombreFmt.format(data.sources.ga4.screenPageViews)} pages vues
                </p>
              ) : (
                <p className="text-xs text-chanv-terre/60">
                  Google Analytics 4 n&apos;est pas encore câblé sur SiteBleuh.
                </p>
              )}
            </div>
            <span className="badge-neutral">
              {data?.sources.ga4.status === "ok" ? "Live" : "Non instrumenté"}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg border border-chanv-fibre p-3">
            <div>
              <p className="font-semibold text-sm">Ventes réelles</p>
              <p className="text-xs text-chanv-terre/60">
                Aucune source de vérité (SQDC/MetroGreen/POS) connectée à ce module.
              </p>
            </div>
            <span className="badge-neutral">Non instrumenté</span>
          </div>
        </div>
      </section>
    </main>
  );
}
