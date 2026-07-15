"use client";

import { useEffect, useState } from "react";

type Period = "7d" | "30d" | "90d";

interface DailyPoint {
  date: string;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

interface CeoKpis {
  period: Period;
  days: number;
  model: string;
  interactions: { total: number; byDay: DailyPoint[] };
  cost: { totalUsd: number; label: string };
  sessions: { total: number; escalated: number; escalationRate: number | null };
}

interface CeoAnalysisResult {
  generatedAt: string;
  period: Period;
  kpis: CeoKpis;
  sources: { ga4: "non_instrumente"; ventes: "non_instrumente" };
  aiSummary: string | null;
}

const PERIOD_LABELS: Record<Period, string> = { "7d": "7 jours", "30d": "30 jours", "90d": "90 jours" };

const nombreFmt = new Intl.NumberFormat("fr-CA");
const usdFmt = new Intl.NumberFormat("fr-CA", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
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

export function AnalyseCeoClient() {
  const [period, setPeriod] = useState<Period>("7d");
  const [data, setData] = useState<CeoAnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
          value={loading || !kpis ? "…" : usdFmt.format(kpis.cost.totalUsd)}
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

      <section className="card p-4">
        <h2 className="text-lg font-semibold mb-1">Sources à instrumenter</h2>
        <p className="text-sm text-chanv-terre/70 mb-3">
          Ces sources ne sont pas encore branchées à ce module — aucun chiffre n&apos;est simulé à leur place.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-center justify-between gap-3 rounded-lg border border-chanv-fibre p-3">
            <div>
              <p className="font-semibold text-sm">Trafic / clics (GA4)</p>
              <p className="text-xs text-chanv-terre/60">
                Google Analytics 4 n&apos;est pas encore câblé sur SiteBleuh.
              </p>
            </div>
            <span className="badge-neutral">Non instrumenté</span>
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
