"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Campaign, CampaignsResponse, CampaignsSummary } from "@/lib/infolettre-types";

type SortKey = "date" | "click";

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
  const [summary, setSummary] = useState<CampaignsSummary | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("date");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/infolettre/campaigns", { cache: "no-store" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Erreur ${res.status}`);
      }
      const data: CampaignsResponse = await res.json();
      setSummary(data.summary);
      setCampaigns(data.campaigns ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible de charger les campagnes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const sorted = useMemo(() => {
    const rows = [...campaigns];
    if (sortKey === "click") {
      rows.sort((a, b) => b.clickRate - a.clickRate);
    } else {
      rows.sort((a, b) => (b.dateSend || "").localeCompare(a.dateSend || ""));
    }
    return rows;
  }, [campaigns, sortKey]);

  const kpis: { label: string; value: string }[] = [
    { label: "Campagnes envoyées", value: summary ? fmtInt(summary.campaigns) : "—" },
    { label: "Destinataires (total)", value: summary ? fmtInt(summary.totalRecipients) : "—" },
    { label: "Taux d'ouverture moyen", value: summary ? fmtPct(summary.avgOpenRate) : "—" },
    { label: "Taux de clic moyen", value: summary ? fmtPct(summary.avgClickRate) : "—" },
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

      {/* Cartes KPI */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        {kpis.map((k) => (
          <div key={k.label} className="section-card">
            <p className="text-xs uppercase tracking-wide text-chanv-terre/50">{k.label}</p>
            <p className="text-2xl font-bold mt-1">{k.value}</p>
          </div>
        ))}
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 mb-4">
          {error}
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
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
                  Aucune campagne envoyée.
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
