"use client";

/**
 * Acquisition — d'où viennent les visites de bleuh.co.
 *
 * ⚠ Aucun chiffre de VENTE sur cet écran, et c'est délibéré : bleuh.co est un
 * site vitrine. L'aboutissement mesurable est le clic sortant vers un
 * détaillant (SQDC/OCS) ; ce qui se passe ensuite chez lui nous est invisible.
 * Chaque intitulé le dit explicitement, pour qu'aucune lecture rapide ne
 * transforme un clic en vente.
 *
 * Parti pris de lecture : chaque graphique ne porte qu'une seule série et son
 * propre titre, donc une teinte de marque unique suffit — deux teintes proches
 * laisseraient croire à une distinction qui n'existe pas. Les comparaisons
 * multi-mesures sont des TABLEAUX.
 */

import { useEffect, useMemo, useState } from "react";
import { useLocale, useT } from "@/lib/i18n";
import { LineChart } from "@/app/(app)/infolettre/charts/LineChart";
import { BarChart } from "@/app/(app)/infolettre/charts/BarChart";
import { formatDuration, type Channel } from "@/lib/acquisition-pure";

/** Teinte de marque (brand-600). Contraste vérifié ≥ 3:1 sur la carte. */
const OR = "#8A7648";

const PERIODS = [7, 30, 90] as const;
type Period = (typeof PERIODS)[number];

interface ChannelRow {
  channel: Channel;
  sessions: number;
  pageViews: number;
  engagementMs: number;
  retailerClicks: number;
  clickRate: number | null;
}
interface CampaignRow {
  key: string;
  channel: Channel;
  source: string;
  medium: string;
  campaign: string;
  sessions: number;
  retailerClicks: number;
}
interface PageRow {
  path: string;
  views: number;
  engagedViews: number;
  engagementMs: number;
  averageEngagementMs: number | null;
}
interface DayPoint {
  date: string;
  sessions: number;
  retailerClicks: number;
}
interface AcquisitionResult {
  generatedAt: string;
  period: Period;
  channels: ChannelRow[];
  campaigns: CampaignRow[];
  pages: PageRow[];
  series: DayPoint[];
  totals: {
    sessions: number;
    pageViews: number;
    retailerClicks: number;
    clickRate: number | null;
    averageEngagementMs: number | null;
  };
  trafficPending: boolean;
}

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card p-4">
      <p className="label mb-1">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs text-chanv-terre/60 mt-1">{sub}</p>}
    </div>
  );
}

export function AcquisitionClient() {
  const t = useT();
  const locale = useLocale();

  const nf = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const pf = useMemo(
    () => new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 2 }),
    [locale]
  );

  const [period, setPeriod] = useState<Period>(30);
  const [data, setData] = useState<AcquisitionResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/acquisition?period=${period}`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err?.error || `HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((json: AcquisitionResult) => {
        if (!cancelled) setData(json);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [period]);

  /** « 2026-08-27 » → « 27 août » ; l'axe n'a pas la place pour l'année. */
  const shortDay = (iso: string) =>
    new Date(`${iso}T12:00:00Z`).toLocaleDateString(locale, {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    });

  const labels = useMemo(() => (data?.series ?? []).map((p) => shortDay(p.date)), [data, locale]);

  return (
    <main className="mx-auto max-w-6xl p-6">
      <div className="flex flex-wrap items-center gap-4 mb-2">
        <h1 className="text-2xl font-bold m-0">{t("acq.title")}</h1>
        <div className="flex gap-1 ml-auto">
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={period === p ? "btn btn-primary" : "btn btn-secondary"}
            >
              {t("acq.days", { n: p })}
            </button>
          ))}
        </div>
      </div>
      <p className="text-sm text-chanv-terre/60 mb-6">{t("acq.subtitle")}</p>

      {loading && <div className="card p-8 text-center text-chanv-terre/50">{t("acq.loading")}</div>}
      {error && !loading && (
        <div className="card p-6 border-2 border-red-200 bg-red-50 text-red-800">
          <p className="font-semibold m-0">{t("acq.error")}</p>
          <p className="text-sm mt-1 m-0">{error}</p>
        </div>
      )}

      {data && !loading && !error && (
        <>
          {/*
            Sans cet avertissement, un écran à zéro passerait pour une panne.
            La mesure vient d'être posée : elle ne peut rien montrer d'avant.
          */}
          {data.trafficPending && (
            <div className="card p-4 mb-4 border-2 border-chanv-beige bg-chanv-fibre text-sm">
              <p className="font-semibold m-0">{t("acq.trafficPending.title")}</p>
              <p className="mt-1 m-0 text-chanv-terre/70">{t("acq.trafficPending.body")}</p>
            </div>
          )}

          {/* Le clic sortant n'est pas une vente : le dire une fois, en clair,
              plutôt que d'espérer que l'intitulé des colonnes suffise. */}
          <div className="card p-3 mb-4 text-xs text-chanv-terre/70">{t("acq.vitrineNote")}</div>

          <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <KpiCard
              label={t("acq.kpi.sessions")}
              value={data.trafficPending ? "—" : nf.format(data.totals.sessions)}
              sub={
                data.trafficPending
                  ? undefined
                  : t("acq.kpi.pageViews", { n: nf.format(data.totals.pageViews) })
              }
            />
            <KpiCard
              label={t("acq.kpi.avgTime")}
              value={formatDuration(data.totals.averageEngagementMs)}
              sub={t("acq.kpi.avgTimeSub")}
            />
            <KpiCard
              label={t("acq.kpi.retailerClicks")}
              value={data.trafficPending ? "—" : nf.format(data.totals.retailerClicks)}
              sub={t("acq.kpi.retailerClicksSub")}
            />
            <KpiCard
              label={t("acq.kpi.clickRate")}
              value={data.totals.clickRate !== null ? pf.format(data.totals.clickRate) : "—"}
              sub={t("acq.kpi.clickRateSub")}
            />
          </section>

          {/* Deux graphiques distincts, un axe chacun. */}
          <section className="grid lg:grid-cols-2 gap-4 mb-6">
            <div className="card p-4">
              <h2 className="text-base font-semibold mb-3 m-0">{t("acq.chart.sessions")}</h2>
              {data.trafficPending ? (
                <p className="text-sm text-chanv-terre/40 py-8 text-center m-0">
                  {t("acq.trafficPending.short")}
                </p>
              ) : (
                <LineChart
                  labels={labels}
                  series={[
                    {
                      label: t("acq.kpi.sessions"),
                      color: OR,
                      values: data.series.map((p) => p.sessions),
                    },
                  ]}
                  formatValue={(v) => nf.format(v)}
                />
              )}
            </div>
            <div className="card p-4">
              <h2 className="text-base font-semibold mb-3 m-0">{t("acq.chart.retailerClicks")}</h2>
              {data.trafficPending ? (
                <p className="text-sm text-chanv-terre/40 py-8 text-center m-0">
                  {t("acq.trafficPending.short")}
                </p>
              ) : (
                <BarChart
                  data={data.series.map((p) => ({
                    label: shortDay(p.date),
                    value: p.retailerClicks,
                  }))}
                  color={OR}
                  formatValue={(v) => nf.format(v)}
                />
              )}
            </div>
          </section>

          <section className="card p-4 mb-6 overflow-x-auto">
            <h2 className="text-base font-semibold mb-1 m-0">{t("acq.channels.title")}</h2>
            <p className="text-xs text-chanv-terre/60 mb-3 m-0">{t("acq.channels.help")}</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-chanv-fibre">
                  <th className="py-2 pr-3">{t("acq.col.channel")}</th>
                  <th className="py-2 px-3 text-right">{t("acq.col.sessions")}</th>
                  <th className="py-2 px-3 text-right">{t("acq.col.pageViews")}</th>
                  <th className="py-2 px-3 text-right">{t("acq.col.retailerClicks")}</th>
                  <th className="py-2 pl-3 text-right">{t("acq.col.clickRate")}</th>
                </tr>
              </thead>
              <tbody>
                {data.channels.map((c) => (
                  <tr key={c.channel} className="border-b border-chanv-fibre/60 last:border-0">
                    <td className="py-2 pr-3 font-medium">{t(`acq.channel.${c.channel}`)}</td>
                    <td className="py-2 px-3 text-right tabular-nums">{nf.format(c.sessions)}</td>
                    <td className="py-2 px-3 text-right tabular-nums">{nf.format(c.pageViews)}</td>
                    <td className="py-2 px-3 text-right tabular-nums">
                      {nf.format(c.retailerClicks)}
                    </td>
                    {/* `null` (aucune session mesurée) ≠ 0 % : ne pas laisser
                        croire que le canal ne produit aucun clic. */}
                    <td className="py-2 pl-3 text-right tabular-nums">
                      {c.clickRate !== null ? pf.format(c.clickRate) : "—"}
                    </td>
                  </tr>
                ))}
                {data.channels.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-chanv-terre/40">
                      {data.trafficPending ? t("acq.trafficPending.short") : t("chart.empty")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>

          <section className="card p-4 mb-6 overflow-x-auto">
            <h2 className="text-base font-semibold mb-1 m-0">{t("acq.campaigns.title")}</h2>
            <p className="text-xs text-chanv-terre/60 mb-3 m-0">{t("acq.campaigns.help")}</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-chanv-fibre">
                  <th className="py-2 pr-3">{t("acq.col.source")}</th>
                  <th className="py-2 px-3">{t("acq.col.medium")}</th>
                  <th className="py-2 px-3">{t("acq.col.campaign")}</th>
                  <th className="py-2 px-3 text-right">{t("acq.col.sessions")}</th>
                  <th className="py-2 pl-3 text-right">{t("acq.col.retailerClicks")}</th>
                </tr>
              </thead>
              <tbody>
                {data.campaigns.slice(0, 20).map((c) => (
                  <tr key={c.key} className="border-b border-chanv-fibre/60 last:border-0">
                    <td className="py-2 pr-3">{c.source}</td>
                    <td className="py-2 px-3 text-chanv-terre/70">{c.medium}</td>
                    <td className="py-2 px-3">{c.campaign}</td>
                    <td className="py-2 px-3 text-right tabular-nums">{nf.format(c.sessions)}</td>
                    <td className="py-2 pl-3 text-right tabular-nums">
                      {nf.format(c.retailerClicks)}
                    </td>
                  </tr>
                ))}
                {data.campaigns.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-chanv-terre/40">
                      {data.trafficPending ? t("acq.trafficPending.short") : t("chart.empty")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>

          <section className="card p-4 overflow-x-auto">
            <h2 className="text-base font-semibold mb-1 m-0">{t("acq.pages.title")}</h2>
            <p className="text-xs text-chanv-terre/60 mb-3 m-0">{t("acq.pages.help")}</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-chanv-fibre">
                  <th className="py-2 pr-3">{t("acq.col.page")}</th>
                  <th className="py-2 px-3 text-right">{t("acq.col.views")}</th>
                  <th className="py-2 pl-3 text-right">{t("acq.col.avgTime")}</th>
                </tr>
              </thead>
              <tbody>
                {data.pages.slice(0, 20).map((p) => (
                  <tr key={p.path} className="border-b border-chanv-fibre/60 last:border-0">
                    <td className="py-2 pr-3 font-mono text-xs">{p.path}</td>
                    <td className="py-2 px-3 text-right tabular-nums">{nf.format(p.views)}</td>
                    <td className="py-2 pl-3 text-right tabular-nums">
                      {formatDuration(p.averageEngagementMs)}
                    </td>
                  </tr>
                ))}
                {data.pages.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-6 text-center text-chanv-terre/40">
                      {data.trafficPending ? t("acq.trafficPending.short") : t("chart.empty")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>

          <p className="text-xs text-chanv-terre/50 mt-4">
            {t("acq.footnote")} · {t("acq.generatedAt")}{" "}
            {new Date(data.generatedAt).toLocaleString(locale)}
          </p>
        </>
      )}
    </main>
  );
}
