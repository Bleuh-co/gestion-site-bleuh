"use client";

import { useEffect, useState } from "react";
import type { Role } from "@/lib/types";
import { useT } from "@/lib/i18n";

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

type Ga4Events =
  | { status: "ok"; selectRetailer: number; viewItem: number }
  | { status: "non_instrumente" };

type CatalogPresence =
  | { status: "ok"; skus: number; collections: number; provinces: string[] }
  | { status: "non_instrumente" };

type SiteTraffic =
  | {
      status: "ok";
      pageViews: number;
      sessions: number;
      retailerClicks: number;
      productViews: number;
      filterUses: number;
    }
  | { status: "en_attente" };

interface CeoAnalysisResult {
  generatedAt: string;
  period: Period;
  kpis: CeoKpis;
  sources: { ga4: Ga4Traffic; ga4Events: Ga4Events; catalogue: CatalogPresence; siteTraffic: SiteTraffic };
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
  const t = useT();
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
          throw new Error(err.error || t("ceoAnalysis.errorStatus", { status: res.status }));
        }
        return res.json();
      })
      .then((json: CeoAnalysisResult) => {
        if (!cancelled) setData(json);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message || t("ceoAnalysis.errorLoad"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [period, t]);

  async function handleRunDeepAnalysis() {
    setDeepLoading(true);
    setDeepError(null);
    try {
      const res = await fetch(`/api/analyse-ceo/run?period=${period}`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || t("ceoAnalysis.errorStatus", { status: res.status }));
      }
      const json: DeepAnalysisResult = await res.json();
      setDeepResult(json);
    } catch (e) {
      setDeepError(e instanceof Error ? e.message : t("ceoAnalysis.errorDeepRun"));
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
          <h1 className="text-2xl font-bold">{t("ceoAnalysis.title")}</h1>
          <p className="text-sm text-chanv-terre/70">{t("ceoAnalysis.subtitle")}</p>
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
              {t("ceoAnalysis.periodDays", { n: parseInt(p, 10) })}
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
          label={t("ceoAnalysis.kpiInteractionsLabel")}
          value={loading || !kpis ? "…" : nombreFmt.format(kpis.interactions.total)}
          sub={kpis ? t("ceoAnalysis.kpiInteractionsSub", { n: kpis.days }) : undefined}
        />
        <KpiCard
          label={t("ceoAnalysis.kpiCostLabel")}
          value={loading || !kpis ? "…" : cadFmt.format(kpis.cost.totalCad)}
          sub={kpis ? t("ceoAnalysis.kpiCostSub", { label: kpis.cost.label, model: kpis.model }) : undefined}
        />
        <KpiCard
          label={t("ceoAnalysis.kpiSessionsLabel")}
          value={loading || !kpis ? "…" : nombreFmt.format(kpis.sessions.total)}
          sub={kpis ? t("ceoAnalysis.kpiSessionsSub", { n: nombreFmt.format(kpis.sessions.escalated) }) : undefined}
        />
        <KpiCard
          label={t("ceoAnalysis.kpiEscalationLabel")}
          value={loading || !kpis ? "…" : escalationRateText}
          sub={kpis && kpis.sessions.total === 0 ? t("ceoAnalysis.kpiEscalationNoSessions") : undefined}
        />
      </div>

      <section className="card p-4 mb-6">
        <h2 className="text-lg font-semibold mb-1">{t("ceoAnalysis.aiSummaryTitle")}</h2>
        {!loading && data && !data.aiSummary && (
          <p className="text-sm text-chanv-terre/70">{t("ceoAnalysis.aiSummaryUnavailable")}</p>
        )}
        {loading && <p className="text-sm text-chanv-terre/70">{t("ceoAnalysis.loading")}</p>}
        {!loading && data?.aiSummary && (
          <div className="text-sm whitespace-pre-line leading-relaxed">{data.aiSummary}</div>
        )}
      </section>

      {canRunDeepAnalysis && (
        <section className="card p-4 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-2">
            <div>
              <h2 className="text-lg font-semibold">{t("ceoAnalysis.deepTitle")}</h2>
              <p className="text-xs text-chanv-terre/60">{t("ceoAnalysis.deepDescription")}</p>
            </div>
            <button
              type="button"
              className="btn-primary"
              onClick={handleRunDeepAnalysis}
              disabled={deepLoading}
            >
              {deepLoading ? t("ceoAnalysis.deepRunning") : t("ceoAnalysis.deepRunButton")}
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
            <p className="text-sm text-chanv-terre/70 mt-3">{t("ceoAnalysis.deepUnavailable")}</p>
          )}
        </section>
      )}

      <section className="card p-4">
        <h2 className="text-lg font-semibold mb-1">{t("ceoAnalysis.signalsTitle")}</h2>
        <p className="text-sm text-chanv-terre/70 mb-3">{t("ceoAnalysis.signalsDescription")}</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="flex items-center justify-between gap-3 rounded-lg border border-chanv-fibre p-3">
            <div>
              <p className="font-semibold text-sm">{t("ceoAnalysis.signalTrafficLabel")}</p>
              {data?.sources.siteTraffic.status === "ok" ? (
                <p className="text-xs text-chanv-terre/60">
                  {t("ceoAnalysis.signalTrafficValue", {
                    views: nombreFmt.format(data.sources.siteTraffic.pageViews),
                    sessions: nombreFmt.format(data.sources.siteTraffic.sessions),
                  })}
                </p>
              ) : (
                <p className="text-xs text-chanv-terre/60">{t("ceoAnalysis.awaitingVisits")}</p>
              )}
            </div>
            <span className="badge-neutral">
              {data?.sources.siteTraffic.status === "ok"
                ? t("ceoAnalysis.badgeLive")
                : t("ceoAnalysis.badgeWaiting")}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg border border-chanv-fibre p-3">
            <div>
              <p className="font-semibold text-sm">{t("ceoAnalysis.signalRetailerLabel")}</p>
              {data?.sources.siteTraffic.status === "ok" ? (
                <p className="text-xs text-chanv-terre/60">
                  {t("ceoAnalysis.signalRetailerValue", {
                    clicks: nombreFmt.format(data.sources.siteTraffic.retailerClicks),
                    views: nombreFmt.format(data.sources.siteTraffic.productViews),
                  })}
                </p>
              ) : (
                <p className="text-xs text-chanv-terre/60">{t("ceoAnalysis.awaitingVisits")}</p>
              )}
              <p className="text-xs text-chanv-terre/50 mt-1">{t("ceoAnalysis.signalRetailerNote")}</p>
            </div>
            <span className="badge-neutral">
              {data?.sources.siteTraffic.status === "ok"
                ? t("ceoAnalysis.badgeLive")
                : t("ceoAnalysis.badgeWaiting")}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg border border-chanv-fibre p-3">
            <div>
              <p className="font-semibold text-sm">{t("ceoAnalysis.signalCatalogLabel")}</p>
              {data?.sources.catalogue.status === "ok" ? (
                <p className="text-xs text-chanv-terre/60">
                  {t("ceoAnalysis.signalCatalogValue", {
                    skus: nombreFmt.format(data.sources.catalogue.skus),
                    collections: nombreFmt.format(data.sources.catalogue.collections),
                    provinces:
                      data.sources.catalogue.provinces.length > 0
                        ? data.sources.catalogue.provinces.map((p) => p.toUpperCase()).join(", ")
                        : t("ceoAnalysis.noProvince"),
                  })}
                </p>
              ) : (
                <p className="text-xs text-chanv-terre/60">{t("ceoAnalysis.signalCatalogEmpty")}</p>
              )}
            </div>
            <span className="badge-neutral">
              {data?.sources.catalogue.status === "ok"
                ? t("ceoAnalysis.badgeLive")
                : t("ceoAnalysis.badgeNotInstrumented")}
            </span>
          </div>
        </div>
      </section>
    </main>
  );
}
