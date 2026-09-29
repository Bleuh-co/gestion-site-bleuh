"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Campaign, CampaignsResponse } from "@/lib/infolettre-types";
import { summarizeCampaigns, type DayRange } from "@/lib/infolettre-campaigns-summary";

type SortKey = "date" | "click";
type PeriodKey = "30d" | "90d" | "12m" | "year" | "all" | "custom";

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "30d", label: "30 jours" },
  { key: "90d", label: "90 jours" },
  { key: "12m", label: "12 mois" },
  { key: "year", label: "Cette année" },
  { key: "all", label: "Tout" },
  { key: "custom", label: "Personnalisée" },
];

/** Jour local "YYYY-MM-DD" (en-CA = format ISO). */
function localDay(d: Date): string {
  return d.toLocaleDateString("en-CA");
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return localDay(d);
}

function presetRange(key: PeriodKey): DayRange {
  switch (key) {
    case "30d":
      return { from: daysAgo(29) };
    case "90d":
      return { from: daysAgo(89) };
    case "12m":
      return { from: daysAgo(364) };
    case "year":
      return { from: `${new Date().getFullYear()}-01-01` };
    default:
      return {};
  }
}

function fmtInt(n: number): string {
  return n.toLocaleString("fr-CA");
}

function fmtPct(n: number): string {
  return `${n.toLocaleString("fr-CA", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
}

function fmtDate(s?: string): string {
  if (!s) return "—";
  // Les dates ML arrivent "YYYY-MM-DD HH:MM:SS" (heure du compte).
  const d = new Date(s.replace(" ", "T"));
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString("fr-CA", { year: "numeric", month: "short", day: "numeric" });
}

const TYPE_LABEL: Record<string, string> = {
  regular: "Régulière",
  followup: "Relance",
  ab: "A/B",
};

export function CampaignsPanel() {
  const [data, setData] = useState<CampaignsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [period, setPeriod] = useState<PeriodKey>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/infolettre/campaigns", { cache: "no-store" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Erreur ${res.status}`);
      }
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible de charger les campagnes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const range: DayRange = useMemo(
    () =>
      period === "custom"
        ? { from: customFrom || undefined, to: customTo || undefined }
        : presetRange(period),
    [period, customFrom, customTo]
  );

  // Toutes les campagnes et dates arrivent en une fois : changer de période
  // recalcule à l'écran, sans rappeler MailerLite.
  const filtered = useMemo(
    () =>
      data
        ? summarizeCampaigns(data.campaigns ?? [], data.unsubscribeDates ?? [], range)
        : null,
    [data, range]
  );
  const summary = filtered?.summary ?? null;

  const sorted = useMemo(() => {
    const rows: Campaign[] = [...(filtered?.campaigns ?? [])];
    if (sortKey === "click") {
      rows.sort((a, b) => b.clickRate - a.clickRate);
    } else {
      rows.sort((a, b) => (b.dateSend || "").localeCompare(a.dateSend || ""));
    }
    return rows;
  }, [filtered, sortKey]);

  const kpis: { label: string; value: string; note?: string }[] = [
    { label: "Campagnes envoyées", value: summary ? fmtInt(summary.campaigns) : "—" },
    { label: "Destinataires (total)", value: summary ? fmtInt(summary.totalRecipients) : "—" },
    { label: "Taux d'ouverture moyen", value: summary ? fmtPct(summary.avgOpenRate) : "—" },
    { label: "Taux de clic moyen", value: summary ? fmtPct(summary.avgClickRate) : "—" },
    {
      label: "Taux de désabonnement",
      value: summary ? fmtPct(summary.unsubscribeRate) : "—",
      note: summary
        ? `${fmtInt(summary.unsubscribes)} désabonnement${summary.unsubscribes > 1 ? "s" : ""}`
        : undefined,
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <p className="text-sm text-chanv-terre/60 max-w-xl">
          Données MailerLite rafraîchies à l&apos;ouverture / à l&apos;actualisation —
          l&apos;analytique email est quasi temps réel (les ouvertures/clics arrivent en continu
          après l&apos;envoi).
        </p>
        <button className="btn-secondary" disabled={loading} onClick={load}>
          {loading ? "Actualisation…" : "Actualiser"}
        </button>
      </div>

      {/* Période */}
      <div className="flex items-center flex-wrap gap-2 mb-4">
        <span className="text-xs uppercase tracking-wide text-chanv-terre/50 mr-1">Période</span>
        {PERIODS.map((p) => (
          <button
            key={p.key}
            type="button"
            className={`chip ${period === p.key ? "chip-active" : ""}`}
            onClick={() => setPeriod(p.key)}
          >
            {p.label}
          </button>
        ))}
        {period === "custom" && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              className="input w-auto"
              aria-label="Du"
              value={customFrom}
              max={customTo || undefined}
              onChange={(e) => setCustomFrom(e.target.value)}
            />
            <span className="text-sm text-chanv-terre/50">au</span>
            <input
              type="date"
              className="input w-auto"
              aria-label="Au"
              value={customTo}
              min={customFrom || undefined}
              onChange={(e) => setCustomTo(e.target.value)}
            />
          </div>
        )}
      </div>

      {/* Cartes KPI */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 mb-6">
        {kpis.map((k) => (
          <div key={k.label} className="section-card">
            <p className="text-xs uppercase tracking-wide text-chanv-terre/50">{k.label}</p>
            <p className="text-2xl font-bold mt-1">{k.value}</p>
            {k.note && <p className="text-xs text-chanv-terre/50 mt-1">{k.note}</p>}
          </div>
        ))}
      </div>
      <p className="text-xs text-chanv-terre/50 -mt-4 mb-6">
        Désabonnement : désabonnements datés dans la période ÷ destinataires des campagnes
        envoyées dans la période. MailerLite ne rattache pas les désabonnements à une campagne
        précise.
      </p>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 mb-4">
          {error}
        </div>
      )}

      <div className="card table-scroll">
        <table className="table-wide text-sm">
          <thead>
            <tr className="text-left text-chanv-terre/60 border-b border-black/5">
              <th className="px-4 py-3 font-semibold">Nom / Sujet</th>
              <th
                className="px-4 py-3 font-semibold whitespace-nowrap cursor-pointer select-none"
                onClick={() => setSortKey("date")}
              >
                Date d&apos;envoi {sortKey === "date" ? "▾" : ""}
              </th>
              <th className="px-4 py-3 font-semibold text-right whitespace-nowrap">Destinataires</th>
              <th className="px-4 py-3 font-semibold text-right whitespace-nowrap">
                Taux d&apos;ouverture
              </th>
              <th
                className="px-4 py-3 font-semibold text-right whitespace-nowrap cursor-pointer select-none"
                onClick={() => setSortKey("click")}
              >
                Taux de clic {sortKey === "click" ? "▾" : ""}
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && !loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  {data?.campaigns?.length
                    ? "Aucune campagne envoyée sur cette période."
                    : "Aucune campagne envoyée."}
                </td>
              </tr>
            ) : (
              sorted.map((c) => (
                <tr key={c.id} className="border-b border-black/5 last:border-0 align-top">
                  <td className="px-4 py-3">
                    <div className="font-medium">{c.name || "—"}</div>
                    <div className="text-xs text-chanv-terre/50">
                      {c.subject}
                      {TYPE_LABEL[c.type] ? (
                        <span className="badge-neutral text-[10px] ml-2">{TYPE_LABEL[c.type]}</span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-chanv-terre/60">
                    {fmtDate(c.dateSend)}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">{fmtInt(c.recipients)}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">{fmtPct(c.openRate)}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap font-medium">
                    {fmtPct(c.clickRate)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {loading && <div className="text-center text-gray-400 text-sm py-4">Chargement…</div>}
    </div>
  );
}
