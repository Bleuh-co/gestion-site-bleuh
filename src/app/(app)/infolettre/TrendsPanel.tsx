"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LineChart, type LineSeries } from "./charts/LineChart";
import { BarChart, type BarDatum } from "./charts/BarChart";

interface MetricsSeriesPoint {
  capturedAt: string;
  total: number;
  active: number;
  unsubscribed: number;
}
interface GroupBreakdown {
  groupId: string;
  name: string;
  active: number;
  total: number;
  growth: number | null;
}
interface MonthlyAggregate {
  month: string;
  campaigns: number;
  recipients: number;
  avgOpenRate: number;
  avgClickRate: number;
}
interface TrendsResponse {
  metricsSeries: MetricsSeriesPoint[];
  byGroup: GroupBreakdown[];
  campaignPoints: unknown[];
  monthly: MonthlyAggregate[];
}

const COLOR = {
  total: "#282828",
  active: "#8A7648",
  unsub: "#C08457",
  open: "#8A7648",
  click: "#4F7A6B",
};

const MONTHS_FR = [
  "janv.", "févr.", "mars", "avr.", "mai", "juin",
  "juill.", "août", "sept.", "oct.", "nov.", "déc.",
];

function fmtInt(n: number): string {
  return Math.round(n).toLocaleString("fr-CA");
}
function fmtPct(n: number): string {
  return `${n.toLocaleString("fr-CA", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
}
function fmtMonth(ym: string): string {
  const [y, m] = ym.split("-");
  const idx = Number(m) - 1;
  return `${MONTHS_FR[idx] ?? m} ${y.slice(2)}`;
}
function fmtDay(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-CA", { day: "numeric", month: "short" });
}
function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString("fr-CA", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-3">
      <h3 className="font-bold">{title}</h3>
      <p className="text-sm text-chanv-terre/55">{subtitle}</p>
    </div>
  );
}

export function TrendsPanel() {
  const [data, setData] = useState<TrendsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/infolettre/trends", { cache: "no-store" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Erreur ${res.status}`);
      }
      setData((await res.json()) as TrendsResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible de charger les tendances.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ── Croissance des abonnés ─────────────────────────────
  const growth = useMemo(() => {
    const s = data?.metricsSeries ?? [];
    const labels = s.map((p) => fmtDay(p.capturedAt));
    const series: LineSeries[] = [
      { label: "Total", color: COLOR.total, values: s.map((p) => p.total) },
      { label: "Actifs", color: COLOR.active, values: s.map((p) => p.active) },
      { label: "Désabonnés", color: COLOR.unsub, values: s.map((p) => p.unsubscribed) },
    ];
    return { labels, series, count: s.length, first: s[0]?.capturedAt };
  }, [data]);

  // ── Ouverture / clic par mois ──────────────────────────
  const rates = useMemo(() => {
    const m = data?.monthly ?? [];
    const labels = m.map((x) => fmtMonth(x.month));
    const series: LineSeries[] = [
      { label: "Taux d'ouverture", color: COLOR.open, values: m.map((x) => x.avgOpenRate) },
      { label: "Taux de clic", color: COLOR.click, values: m.map((x) => x.avgClickRate) },
    ];
    return { labels, series, count: m.length };
  }, [data]);

  // ── Volume d'envoi par mois ────────────────────────────
  const volume: BarDatum[] = useMemo(
    () =>
      (data?.monthly ?? []).map((x) => ({
        label: fmtMonth(x.month),
        value: x.recipients,
      })),
    [data]
  );

  // ── Ventilation par groupe (dernier snapshot) ──────────
  const groups: BarDatum[] = useMemo(
    () => (data?.byGroup ?? []).map((g) => ({ label: g.name, value: g.active })),
    [data]
  );

  if (loading && !data)
    return <div className="card p-8 text-center text-gray-400">Chargement des tendances…</div>;
  if (error)
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
        {error}
      </div>
    );
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm text-chanv-terre/60 max-w-xl">
          Les chiffres qui parlent : santé de la liste dans le temps et performance des campagnes
          par mois. Survolez un point ou une barre pour le détail.
        </p>
        <button className="btn-secondary" disabled={loading} onClick={load}>
          {loading ? "Actualisation…" : "Actualiser"}
        </button>
      </div>

      {/* Croissance des abonnés */}
      <div className="section-card">
        <SectionTitle
          title="Croissance des abonnés"
          subtitle="Total, actifs et désabonnés à chaque capture (toutes les 6 h)."
        />
        {growth.count >= 2 ? (
          <LineChart labels={growth.labels} series={growth.series} formatValue={fmtInt} />
        ) : (
          <div className="rounded-xl bg-chanv-fibre/60 px-4 py-6 text-sm text-chanv-terre/70">
            La courbe se construit —{" "}
            {growth.first
              ? `1re capture le ${fmtDateTime(growth.first)}`
              : "aucune capture encore"}
            , prochaine dans quelques heures. Un seul point ne fait pas une tendance : on préfère
            attendre plutôt qu&apos;afficher une fausse courbe.
          </div>
        )}
      </div>

      {/* Évolution ouverture / clic */}
      <div className="section-card">
        <SectionTitle
          title="Évolution ouverture / clic"
          subtitle="Moyennes mensuelles pondérées par le nombre de destinataires."
        />
        {rates.count >= 2 ? (
          <LineChart
            labels={rates.labels}
            series={rates.series}
            formatValue={(v) => v.toLocaleString("fr-CA", { maximumFractionDigits: 1 })}
            yUnit=" %"
          />
        ) : rates.count === 1 ? (
          <p className="text-sm text-chanv-terre/70">
            Un seul mois de campagnes pour l&apos;instant ({fmtMonth(data.monthly[0].month)} :{" "}
            {fmtPct(data.monthly[0].avgOpenRate)} d&apos;ouverture,{" "}
            {fmtPct(data.monthly[0].avgClickRate)} de clic). La tendance apparaîtra dès le 2e mois.
          </p>
        ) : (
          <p className="text-sm text-chanv-terre/40">Aucune campagne datée.</p>
        )}
      </div>

      {/* Volume d'envoi */}
      <div className="section-card">
        <SectionTitle
          title="Volume d'envoi"
          subtitle="Destinataires touchés par mois (somme de toutes les campagnes)."
        />
        <BarChart data={volume} formatValue={fmtInt} />
      </div>

      {/* Ventilation par groupe */}
      <div className="section-card">
        <SectionTitle
          title="Ventilation par groupe"
          subtitle="Abonnés actifs par liste, à la dernière capture."
        />
        <BarChart data={groups} formatValue={fmtInt} color="#4F7A6B" />
      </div>
    </div>
  );
}
