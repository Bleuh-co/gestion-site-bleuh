"use client";

import type { ResultBanner, SelftestReport } from "./assistant-types";

interface AssistantSelftestProps {
  report: SelftestReport | null;
  busy: boolean;
  result: ResultBanner;
  canWrite: boolean;
  onRun: () => void;
}

export function AssistantSelftest({ report, busy, result, canWrite, onRun }: AssistantSelftestProps) {
  return (
    <div className="space-y-4">
      <div className="card p-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm text-chanv-terre/70">
            Lance la batterie de conformité (~36 appels modèle) contre la configuration en cours d&apos;édition. Coûte un
            appel modèle par question — usage modéré.
          </p>
          {report && (
            <p className="text-sm font-semibold mt-1">
              Réussis : {report.passed} — Échecs : {report.failed} — Total : {report.total}
            </p>
          )}
        </div>
        <button type="button" className="btn-primary" disabled={!canWrite || busy} onClick={onRun}>
          {busy ? "Exécution…" : "Lancer la batterie"}
        </button>
      </div>

      {result && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            result.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          {result.message}
        </div>
      )}

      {report && report.details.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-chanv-fibre">
                <th className="px-4 py-2">ID</th>
                <th className="px-4 py-2">Statut</th>
                <th className="px-4 py-2">Détail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-chanv-fibre">
              {report.details.map((d) => (
                <tr key={d.id}>
                  <td className="px-4 py-2 font-mono text-xs">{d.id}</td>
                  <td className="px-4 py-2">
                    <span className={d.ok ? "badge-accent" : "badge-neutral"}>{d.ok ? "OK" : "Échec"}</span>
                  </td>
                  <td className="px-4 py-2 text-chanv-terre/70">
                    {d.ok ? d.extrait || "" : (d.raisons || []).join(" | ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
