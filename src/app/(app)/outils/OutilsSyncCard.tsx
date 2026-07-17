"use client";

import { useState } from "react";
import { SYNCS, heartbeatText, outilsFetch, resultMessage, type ResultBanner } from "./outils-types";
import { OutilsResultBanner } from "./OutilsResultBanner";
import { useT } from "@/lib/i18n";

interface OutilsSyncCardProps {
  heartbeats: Record<string, unknown> | null;
  onAfterRun: () => void;
}

/** Section 2 — Synchronisations (POST /api/outils/sync/:target). Gestionnaire+ (section masquée sinon). */
export function OutilsSyncCard({ heartbeats, onAfterRun }: OutilsSyncCardProps) {
  const t = useT();
  const [busyTarget, setBusyTarget] = useState<string | null>(null);
  const [result, setResult] = useState<ResultBanner>(null);

  const runSync = async (target: string, label: string) => {
    setBusyTarget(target);
    setResult(null);
    try {
      const data = await outilsFetch(`/sync/${encodeURIComponent(target)}`, { method: "POST" });
      setResult({ ok: true, message: `${label} — ${resultMessage(data)}` });
    } catch (e) {
      setResult({ ok: false, message: `${label} — ${e instanceof Error ? e.message : t("outils.errorGeneric")}` });
    } finally {
      setBusyTarget(null);
      onAfterRun();
    }
  };

  return (
    <section className="card p-4 space-y-3">
      <div>
        <h2 className="text-lg font-semibold">{t("outils.syncsTitle")}</h2>
        <p className="text-sm text-chanv-terre/70">{t("outils.syncsIntro")}</p>
      </div>

      <OutilsResultBanner result={result} />

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-chanv-fibre">
              <th className="px-4 py-2">{t("outils.colTarget")}</th>
              <th className="px-4 py-2">{t("outils.colLastRun")}</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-chanv-fibre">
            {SYNCS.map((s) => (
              <tr key={s.target}>
                <td className="px-4 py-2">{s.label}</td>
                <td className="px-4 py-2 text-chanv-terre/70">{heartbeatText(heartbeats?.[s.heartbeat])}</td>
                <td className="px-4 py-2 text-right">
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={busyTarget !== null}
                    onClick={() => void runSync(s.target, s.label)}
                  >
                    {busyTarget === s.target ? t("outils.running") : t("outils.run")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
