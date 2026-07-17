"use client";

import { SYNCS, heartbeatText, type ResultBanner } from "./outils-types";
import { OutilsResultBanner } from "./OutilsResultBanner";
import { useT } from "@/lib/i18n";

interface OutilsStatusCardProps {
  heartbeats: Record<string, unknown> | null;
  loading: boolean;
  error: ResultBanner;
  onRefresh: () => void;
}

/** Section 1 — Statut / heartbeats (GET /api/outils/status). Lecture consultant+. */
export function OutilsStatusCard({ heartbeats, loading, error, onRefresh }: OutilsStatusCardProps) {
  const t = useT();
  return (
    <section className="card p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold">{t("outils.status")}</h2>
          <p className="text-sm text-chanv-terre/70">{t("outils.statusIntro")}</p>
        </div>
        <button type="button" className="btn-secondary" disabled={loading} onClick={onRefresh}>
          {loading ? t("outils.refreshing") : t("outils.refresh")}
        </button>
      </div>

      <OutilsResultBanner result={error} />

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-chanv-fibre">
              <th className="px-4 py-2">{t("outils.colSync")}</th>
              <th className="px-4 py-2">{t("outils.colLastRun")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-chanv-fibre">
            {SYNCS.map((s) => (
              <tr key={s.target}>
                <td className="px-4 py-2">{s.label}</td>
                <td className="px-4 py-2 text-chanv-terre/70">
                  {loading && !heartbeats ? "…" : heartbeatText(heartbeats?.[s.heartbeat])}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
