"use client";

import { SYNCS, heartbeatText, type ResultBanner } from "./outils-types";
import { OutilsResultBanner } from "./OutilsResultBanner";

interface OutilsStatusCardProps {
  heartbeats: Record<string, unknown> | null;
  loading: boolean;
  error: ResultBanner;
  onRefresh: () => void;
}

/** Section 1 — Statut / heartbeats (GET /api/outils/status). Lecture consultant+. */
export function OutilsStatusCard({ heartbeats, loading, error, onRefresh }: OutilsStatusCardProps) {
  return (
    <section className="card p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold">Statut</h2>
          <p className="text-sm text-chanv-terre/70">
            Dernière exécution connue de chaque synchronisation côté BleuhAPI.
          </p>
        </div>
        <button type="button" className="btn-secondary" disabled={loading} onClick={onRefresh}>
          {loading ? "Actualisation…" : "Actualiser"}
        </button>
      </div>

      <OutilsResultBanner result={error} />

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-chanv-fibre">
              <th className="px-4 py-2">Synchronisation</th>
              <th className="px-4 py-2">Dernière exécution</th>
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
