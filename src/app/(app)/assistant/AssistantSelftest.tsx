"use client";

import { useT } from "@/lib/i18n";
import type { ResultBanner, SelftestReport } from "./assistant-types";

interface AssistantSelftestProps {
  report: SelftestReport | null;
  busy: boolean;
  result: ResultBanner;
  canWrite: boolean;
  onRun: () => void;
}

export function AssistantSelftest({ report, busy, result, canWrite, onRun }: AssistantSelftestProps) {
  const t = useT();
  return (
    <div className="space-y-4">
      <div className="card p-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm text-chanv-terre/70">
            {t("assistant.selftestIntro")}
          </p>
          {report && (
            <p className="text-sm font-semibold mt-1">
              {t("assistant.selftestSummary", { passed: report.passed, failed: report.failed, total: report.total })}
            </p>
          )}
        </div>
        <button type="button" className="btn-primary" disabled={!canWrite || busy} onClick={onRun}>
          {busy ? t("assistant.running") : t("assistant.runBattery")}
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
                <th className="px-4 py-2">{t("assistant.thId")}</th>
                <th className="px-4 py-2">{t("assistant.thStatus")}</th>
                <th className="px-4 py-2">{t("assistant.thDetail")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-chanv-fibre">
              {report.details.map((d) => (
                <tr key={d.id}>
                  <td className="px-4 py-2 font-mono text-xs">{d.id}</td>
                  <td className="px-4 py-2">
                    <span className={d.ok ? "badge-accent" : "badge-neutral"}>{d.ok ? t("assistant.statusOk") : t("assistant.statusFail")}</span>
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
