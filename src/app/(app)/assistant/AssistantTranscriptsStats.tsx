"use client";

import { Fragment, useEffect, useState } from "react";
import { useT } from "@/lib/i18n";
import type { StatsResponse, Transcript } from "./assistant-types";
import { readApiError } from "./assistant-types";

interface AssistantTranscriptsStatsProps {
  active: boolean;
}

function fmtDate(v: string | undefined): string {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString("fr-CA");
}

export function AssistantTranscriptsStats({ active }: AssistantTranscriptsStatsProps) {
  const t = useT();
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Recharge stats + transcripts à chaque activation de cet onglet.
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      fetch("/api/assistant/stats", { cache: "no-store" }).then(async (res) => {
        if (!res.ok) throw new Error(await readApiError(res));
        return (await res.json()) as StatsResponse;
      }),
      fetch("/api/assistant/transcripts?limit=50", { cache: "no-store" }).then(async (res) => {
        if (!res.ok) throw new Error(await readApiError(res));
        const data = (await res.json()) as { transcripts?: Transcript[] };
        return data.transcripts || [];
      }),
    ])
      .then(([statsData, transcriptsData]) => {
        if (cancelled) return;
        setStats(statsData);
        setTranscripts(transcriptsData);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : t("assistant.loadingError"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [active, t]);

  const escalationPct = stats ? ((stats.escalation?.rate || 0) * 100).toFixed(1) : "0.0";

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      )}

      <div className="card p-4">
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <h3 className="font-semibold">{t("assistant.volumeCostTitle")}</h3>
          {loading && <span className="text-sm text-chanv-terre/40">{t("assistant.loading")}</span>}
        </div>
        <p className="text-sm text-chanv-terre/70 mb-3">
          {t("assistant.statsSummary", {
            cost: (stats?.todayCostUsd ?? 0).toFixed(2),
            escalated: stats?.escalation?.escalated ?? 0,
            total: stats?.escalation?.total ?? 0,
            pct: escalationPct,
          })}
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-chanv-fibre">
                <th className="px-4 py-2">{t("assistant.thDate")}</th>
                <th className="px-4 py-2">{t("assistant.thRequests")}</th>
                <th className="px-4 py-2">{t("assistant.thCost")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-chanv-fibre">
              {(stats?.days || []).length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-chanv-terre/40">
                    —
                  </td>
                </tr>
              ) : (
                (stats?.days || []).map((d) => (
                  <tr key={d.date}>
                    <td className="px-4 py-2">{d.date}</td>
                    <td className="px-4 py-2">{d.requests}</td>
                    <td className="px-4 py-2">{(d.costUsd ?? 0).toFixed(4)} $</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card p-4">
        <h3 className="font-semibold mb-3">{t("assistant.recentTranscripts")}</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-chanv-fibre">
                <th className="px-4 py-2">{t("assistant.thDate")}</th>
                <th className="px-4 py-2">{t("assistant.languageLabel")}</th>
                <th className="px-4 py-2">{t("assistant.regionLabel")}</th>
                <th className="px-4 py-2">{t("assistant.thOutcome")}</th>
                <th className="px-4 py-2">{t("assistant.thMessages")}</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-chanv-fibre">
              {transcripts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-chanv-terre/40">
                    {t("assistant.noTranscripts")}
                  </td>
                </tr>
              ) : (
                transcripts.map((tx, i) => (
                  <Fragment key={i}>
                    <tr>
                      <td className="px-4 py-2">{fmtDate(tx.updatedAt)}</td>
                      <td className="px-4 py-2">{(tx.locale || "—").toUpperCase()}</td>
                      <td className="px-4 py-2">{(tx.region || "—").toUpperCase()}</td>
                      <td className="px-4 py-2">
                        <span className={tx.outcome === "escalated" ? "badge-neutral" : "badge-accent"}>
                          {tx.outcome || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-2">{(tx.messages || []).length}</td>
                      <td className="px-4 py-2">
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => setOpenIndex((cur) => (cur === i ? null : i))}
                        >
                          {t("assistant.view")}
                        </button>
                      </td>
                    </tr>
                    {openIndex === i && (
                      <tr>
                        <td colSpan={6} className="px-4 py-3 bg-chanv-fibre/30">
                          <div className="space-y-2 max-h-64 overflow-y-auto">
                            {(tx.messages || []).map((m, j) => (
                              <div
                                key={j}
                                className={`rounded-xl px-3 py-2 text-sm max-w-[80%] ${
                                  m.role === "user" ? "bg-chanv-terre text-chanv-blanc ml-auto" : "bg-chanv-blanc border border-chanv-fibre"
                                }`}
                              >
                                {m.content}
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
