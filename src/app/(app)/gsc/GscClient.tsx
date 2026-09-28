"use client";

/**
 * Performance Google — tableau de bord Search Console pour les employés.
 * Jumeau de l'écran /gsc de marketing-mdh (collection `gsc_daily` ici).
 *
 * Source : l'archive Firestore quotidienne remplie chaque nuit par le cron
 * /api/gsc/sync — PAS l'API Google en direct. L'écran reste donc instantané
 * et fonctionne même si Google est injoignable.
 *
 * Même parti pris de lecture que l'écran Acquisition : une seule teinte de
 * marque, un graphique = une mesure = un axe (clics et impressions diffèrent
 * d'un facteur ~30, les superposer fabriquerait une corrélation visuelle
 * arbitraire), et les comparaisons multi-colonnes sont des TABLEAUX.
 */

import { useEffect, useMemo, useState } from "react";
import { useLocale, useT } from "@/lib/i18n";
import { LineChart } from "@/app/(app)/infolettre/charts/LineChart";
import type { Role } from "@/lib/types";
import type { GscEntry, GscSitemapInfo, GscTotals } from "@/lib/gsc-pure";

/** Teinte de marque (brand-600). Contraste vérifié ≥ 3:1 sur la carte blanche. */
const OR = "#8A7648";

/** 28 jours est la fenêtre par défaut de Search Console lui-même. */
const PERIODS = [7, 28, 90, 365] as const;
type Period = (typeof PERIODS)[number];

interface GscReportPayload {
  empty?: boolean;
  siteUrl: string;
  days: { date: string; totals: GscTotals }[];
  totals: GscTotals;
  prevTotals: GscTotals | null;
  queries: GscEntry[];
  pages: GscEntry[];
  devices: GscEntry[];
  countries: GscEntry[];
  sitemaps: GscSitemapInfo[];
  latest: { date: string } | null;
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

/** Chemin lisible d'une URL de page (l'hôte est le même partout). */
function pagePath(url: string): string {
  return url.replace(/^https?:\/\/[^/]+/, "") || "/";
}

export function GscClient({ role }: { role: Role }) {
  const t = useT();
  const locale = useLocale();
  const canWrite = role === "gestionnaire" || role === "admin" || role === "superadmin";

  const nf = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const pf = useMemo(
    () => new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 2 }),
    [locale]
  );
  const posf = useMemo(
    () => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }),
    [locale]
  );

  const [period, setPeriod] = useState<Period>(28);
  const [data, setData] = useState<GscReportPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/gsc/report?days=${period}`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err?.error || `HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((json: GscReportPayload) => {
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
  }, [period, refresh]);

  /** Rejoue la synchro des 3 derniers jours publiés (J-4 → J-2), puis recharge. */
  const runSync = () => {
    setSyncing(true);
    setSyncMsg(null);
    fetch("/api/gsc/sync", { method: "POST" })
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err?.error || `HTTP ${res.status}`);
        }
        setSyncMsg(t("gsc.syncDone"));
        setRefresh((n) => n + 1);
      })
      .catch((e: Error) => setSyncMsg(`${t("gsc.syncError")} ${e.message}`))
      .finally(() => setSyncing(false));
  };

  /** « 2026-08-27 » → « 27 août » ; l'axe n'a pas la place pour l'année. */
  const shortDay = (iso: string) =>
    new Date(`${iso}T12:00:00Z`).toLocaleDateString(locale, {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    });

  const labels = useMemo(() => (data?.days ?? []).map((p) => shortDay(p.date)), [data, locale]);

  /**
   * Variation vs période précédente, en pourcentage relatif. `null` = pas de
   * période complète à comparer (on n'affiche RIEN plutôt qu'un faux zéro).
   */
  const delta = (cur: number, prev: number | undefined | null): string | undefined => {
    if (prev == null || prev === 0) return undefined;
    const d = (cur - prev) / prev;
    const sign = d > 0 ? "+" : "";
    return `${sign}${pf.format(d)} ${t("gsc.vsPrev")}`;
  };

  /** Pour la position, la variation se lit en places, et descendre = gagner. */
  const deltaPos = (cur: number, prev: number | undefined | null): string | undefined => {
    if (prev == null || prev === 0 || cur === 0) return undefined;
    const d = cur - prev;
    const sign = d > 0 ? "+" : "";
    return `${sign}${posf.format(d)} ${t("gsc.vsPrev")}`;
  };

  const deviceLabel = (key: string) => {
    const k = key.toUpperCase();
    if (k === "MOBILE") return t("gsc.device.mobile");
    if (k === "DESKTOP") return t("gsc.device.desktop");
    if (k === "TABLET") return t("gsc.device.tablet");
    return key;
  };

  const empty = data?.empty === true;
  const ready = data && !empty && !loading && !error;

  const entryTable = (
    title: string,
    help: string,
    rows: GscEntry[],
    keyLabel: string,
    renderKey: (k: string) => string,
    mono: boolean
  ) => (
    <section className="card p-4 mb-6">
      <h2 className="text-base font-semibold mb-1 m-0">{title}</h2>
      <p className="text-xs text-chanv-terre/60 mb-3 m-0">{help}</p>
      <div className="table-scroll">
        <table className="table-wide text-sm">
          <thead>
            <tr className="text-left border-b border-chanv-fibre">
              <th className="py-2 pr-3">{keyLabel}</th>
              <th className="py-2 px-3 text-right">{t("gsc.col.clicks")}</th>
              <th className="py-2 px-3 text-right">{t("gsc.col.impressions")}</th>
              <th className="py-2 px-3 text-right">{t("gsc.col.ctr")}</th>
              <th className="py-2 pl-3 text-right">{t("gsc.col.position")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 20).map((e) => (
              <tr key={e.key} className="border-b border-chanv-fibre/60 last:border-0">
                <td className={`py-2 pr-3 ${mono ? "font-mono text-xs" : "font-medium"}`}>
                  {renderKey(e.key)}
                </td>
                <td className="py-2 px-3 text-right tabular-nums">{nf.format(e.clicks)}</td>
                <td className="py-2 px-3 text-right tabular-nums">{nf.format(e.impressions)}</td>
                <td className="py-2 px-3 text-right tabular-nums">{pf.format(e.ctr)}</td>
                <td className="py-2 pl-3 text-right tabular-nums">
                  {e.position > 0 ? posf.format(e.position) : "—"}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-chanv-terre/40">
                  {t("chart.empty")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );

  return (
    <main className="mx-auto max-w-6xl p-6">
      <div className="flex flex-wrap items-center gap-4 mb-2">
        <h1 className="text-2xl font-bold m-0">{t("gsc.title")}</h1>
        <div className="flex flex-wrap gap-1 ml-auto">
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={period === p ? "btn btn-primary" : "btn btn-secondary"}
            >
              {t("gsc.days", { n: p })}
            </button>
          ))}
          {canWrite && (
            <button
              type="button"
              onClick={runSync}
              disabled={syncing}
              className="btn btn-secondary"
              title={t("gsc.syncHint")}
            >
              {syncing ? t("gsc.syncing") : t("gsc.sync")}
            </button>
          )}
        </div>
      </div>
      <p className="text-sm text-chanv-terre/60 mb-6">{t("gsc.subtitle")}</p>
      {syncMsg && <p className="text-sm text-chanv-terre/70 mb-4">{syncMsg}</p>}

      {loading && <div className="card p-8 text-center text-chanv-terre/50">{t("gsc.loading")}</div>}
      {error && !loading && (
        <div className="card p-6 border-2 border-red-200 bg-red-50 text-red-800">
          <p className="font-semibold m-0">{t("gsc.error")}</p>
          <p className="text-sm mt-1 m-0">{error}</p>
        </div>
      )}
      {empty && !loading && !error && (
        <div className="card p-8 text-center">
          <p className="font-semibold m-0">{t("gsc.empty.title")}</p>
          <p className="text-sm text-chanv-terre/60 mt-2 m-0">{t("gsc.empty.body")}</p>
        </div>
      )}

      {ready && (
        <>
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <KpiCard
              label={t("gsc.kpi.clicks")}
              value={nf.format(data.totals.clicks)}
              sub={delta(data.totals.clicks, data.prevTotals?.clicks)}
            />
            <KpiCard
              label={t("gsc.kpi.impressions")}
              value={nf.format(data.totals.impressions)}
              sub={delta(data.totals.impressions, data.prevTotals?.impressions)}
            />
            <KpiCard
              label={t("gsc.kpi.ctr")}
              value={pf.format(data.totals.ctr)}
              sub={delta(data.totals.ctr, data.prevTotals?.ctr)}
            />
            <KpiCard
              label={t("gsc.kpi.position")}
              value={data.totals.position > 0 ? posf.format(data.totals.position) : "—"}
              sub={
                deltaPos(data.totals.position, data.prevTotals?.position) ??
                t("gsc.kpi.positionHint")
              }
            />
          </section>

          <section className="grid lg:grid-cols-2 gap-4 mb-6">
            {(
              [
                { title: t("gsc.chart.clicks"), values: data.days.map((p) => p.totals.clicks) },
                {
                  title: t("gsc.chart.impressions"),
                  values: data.days.map((p) => p.totals.impressions),
                },
              ] as const
            ).map((chart) => (
              <div key={chart.title} className="card p-4">
                <h2 className="text-base font-semibold mb-3 m-0">{chart.title}</h2>
                <LineChart
                  labels={labels}
                  series={[{ label: chart.title, color: OR, values: [...chart.values] }]}
                  formatValue={(v) => nf.format(v)}
                />
              </div>
            ))}
          </section>

          {entryTable(
            t("gsc.queries.title"),
            t("gsc.queries.help"),
            data.queries,
            t("gsc.col.query"),
            (k) => k,
            false
          )}
          {entryTable(
            t("gsc.pages.title"),
            t("gsc.pages.help"),
            data.pages,
            t("gsc.col.page"),
            pagePath,
            true
          )}

          <section className="grid lg:grid-cols-2 gap-4 mb-6">
            <div className="card p-4">
              <h2 className="text-base font-semibold mb-3 m-0">{t("gsc.devices.title")}</h2>
              <table className="w-full text-sm">
                <tbody>
                  {data.devices.map((e) => (
                    <tr key={e.key} className="border-b border-chanv-fibre/60 last:border-0">
                      <td className="py-2 pr-3 font-medium">{deviceLabel(e.key)}</td>
                      <td className="py-2 px-3 text-right tabular-nums">
                        {nf.format(e.clicks)} {t("gsc.unit.clicks")}
                      </td>
                      <td className="py-2 pl-3 text-right tabular-nums text-chanv-terre/60">
                        {nf.format(e.impressions)} {t("gsc.unit.impressions")}
                      </td>
                    </tr>
                  ))}
                  {data.devices.length === 0 && (
                    <tr>
                      <td className="py-6 text-center text-chanv-terre/40">{t("chart.empty")}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="card p-4">
              <h2 className="text-base font-semibold mb-3 m-0">{t("gsc.countries.title")}</h2>
              <table className="w-full text-sm">
                <tbody>
                  {data.countries.slice(0, 8).map((e) => (
                    <tr key={e.key} className="border-b border-chanv-fibre/60 last:border-0">
                      <td className="py-2 pr-3 font-medium">{e.key.toUpperCase()}</td>
                      <td className="py-2 px-3 text-right tabular-nums">
                        {nf.format(e.clicks)} {t("gsc.unit.clicks")}
                      </td>
                      <td className="py-2 pl-3 text-right tabular-nums text-chanv-terre/60">
                        {nf.format(e.impressions)} {t("gsc.unit.impressions")}
                      </td>
                    </tr>
                  ))}
                  {data.countries.length === 0 && (
                    <tr>
                      <td className="py-6 text-center text-chanv-terre/40">{t("chart.empty")}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card p-4 mb-6">
            <h2 className="text-base font-semibold mb-1 m-0">{t("gsc.sitemaps.title")}</h2>
            <p className="text-xs text-chanv-terre/60 mb-3 m-0">{t("gsc.sitemaps.help")}</p>
            <div className="table-scroll">
              <table className="table-wide text-sm">
                <thead>
                  <tr className="text-left border-b border-chanv-fibre">
                    <th className="py-2 pr-3">{t("gsc.col.sitemap")}</th>
                    <th className="py-2 px-3 text-right">{t("gsc.col.submitted")}</th>
                    <th className="py-2 px-3 text-right">{t("gsc.col.indexed")}</th>
                    <th className="py-2 pl-3 text-right">{t("gsc.col.errors")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.sitemaps.map((s) => (
                    <tr key={s.path} className="border-b border-chanv-fibre/60 last:border-0">
                      <td className="py-2 pr-3 font-mono text-xs">{pagePath(s.path)}</td>
                      <td className="py-2 px-3 text-right tabular-nums">{nf.format(s.submitted)}</td>
                      <td className="py-2 px-3 text-right tabular-nums">{nf.format(s.indexed)}</td>
                      <td className="py-2 pl-3 text-right tabular-nums">
                        {s.errors > 0 ? (
                          <span className="text-red-700 font-semibold">{nf.format(s.errors)}</span>
                        ) : (
                          "0"
                        )}
                      </td>
                    </tr>
                  ))}
                  {data.sitemaps.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-chanv-terre/40">
                        {t("chart.empty")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <p className="text-xs text-chanv-terre/50 mt-4">
            {t("gsc.footnote", {
              site: data.siteUrl,
              date: data.latest ? shortDay(data.latest.date) : "—",
            })}
          </p>
        </>
      )}
    </main>
  );
}
