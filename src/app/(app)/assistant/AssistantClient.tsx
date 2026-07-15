"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Role } from "@/lib/types";
import { AssistantConfigForm } from "./AssistantConfigForm";
import { AssistantSandbox } from "./AssistantSandbox";
import { AssistantSelftest } from "./AssistantSelftest";
import { AssistantTranscriptsStats } from "./AssistantTranscriptsStats";
import {
  EMPTY_CONFIG,
  readApiError,
  type AssistantConfig,
  type LegalCore,
  type ResultBanner,
  type SelftestReport,
} from "./assistant-types";

interface AssistantClientProps {
  role: Role;
}

type Tab = "config" | "sandbox" | "selftest" | "data";

const TABS: { id: Tab; label: string }[] = [
  { id: "config", label: "Configuration" },
  { id: "sandbox", label: "Bac à sable" },
  { id: "selftest", label: "Auto-test" },
  { id: "data", label: "Transcripts & stats" },
];

export function AssistantClient({ role }: AssistantClientProps) {
  const canWrite = role === "gestionnaire" || role === "admin" || role === "superadmin";

  const [tab, setTab] = useState<Tab>("config");
  const initedRef = useRef(false);

  const [config, setConfig] = useState<AssistantConfig>(EMPTY_CONFIG);
  const [legalCore, setLegalCore] = useState<LegalCore>({ fr: "", en: "" });
  const [configLoading, setConfigLoading] = useState(true);
  const [configLoadError, setConfigLoadError] = useState<string | null>(null);
  const [publishBusy, setPublishBusy] = useState(false);
  const [publishResult, setPublishResult] = useState<ResultBanner>(null);

  const [selftestReport, setSelftestReport] = useState<SelftestReport | null>(null);
  const [selftestBusy, setSelftestBusy] = useState(false);
  const [selftestResult, setSelftestResult] = useState<ResultBanner>(null);

  const loadConfig = useCallback(async () => {
    setConfigLoading(true);
    setConfigLoadError(null);
    try {
      const res = await fetch("/api/assistant/config", { cache: "no-store" });
      if (!res.ok) throw new Error(await readApiError(res));
      const data = await res.json();
      setConfig({ ...EMPTY_CONFIG, ...(data.config || {}) });
      setLegalCore(data.legalCore || { fr: "", en: "" });
    } catch (e) {
      setConfigLoadError(e instanceof Error ? e.message : "Impossible de charger la configuration.");
    } finally {
      setConfigLoading(false);
    }
  }, []);

  // Chargée une seule fois — les activations d'onglet suivantes ne doivent
  // pas écraser l'édition non publiée en cours (cf. `inited` côté Express/UI).
  useEffect(() => {
    if (initedRef.current) return;
    initedRef.current = true;
    void loadConfig();
  }, [loadConfig]);

  const runSelftestCore = useCallback(async (): Promise<SelftestReport> => {
    setSelftestBusy(true);
    try {
      const res = await fetch("/api/assistant/selftest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.message || `Erreur ${res.status}`);
      const report: SelftestReport = {
        passed: data.passed ?? 0,
        failed: data.failed ?? 0,
        total: data.total ?? 0,
        details: data.details ?? [],
      };
      setSelftestReport(report);
      setSelftestResult({
        ok: report.failed === 0,
        message: report.failed === 0 ? "Tous les tests sont passés." : `${report.failed} test(s) en échec.`,
      });
      return report;
    } finally {
      setSelftestBusy(false);
    }
  }, []);

  const handleSelftestClick = useCallback(() => {
    if (!window.confirm("Lancer la batterie de conformité (~36 appels modèle, coûte du budget IA) ?")) return;
    setSelftestResult(null);
    runSelftestCore().catch((e) => {
      setSelftestResult({ ok: false, message: e instanceof Error ? e.message : "Erreur." });
    });
  }, [runSelftestCore]);

  const handleConfigChange = useCallback((patch: Partial<AssistantConfig>) => {
    setConfig((prev) => ({ ...prev, ...patch }));
  }, []);

  const handlePublish = useCallback(async () => {
    if (!window.confirm("Publier cette nouvelle configuration de l'assistant ?")) return;
    setPublishBusy(true);
    setPublishResult(null);
    try {
      const res = await fetch("/api/assistant/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.message || `Erreur ${res.status}`);
      setPublishResult({ ok: true, message: `Version ${data.version ?? "?"} publiée.` });
      await loadConfig();
    } catch (e) {
      setPublishResult({ ok: false, message: e instanceof Error ? e.message : "Erreur de publication." });
      setPublishBusy(false);
      return;
    }

    // Auto-test post-publication : non bloquant sur l'échec, alerte visuelle seulement.
    setPublishResult({ ok: true, message: "Publication réussie — lancement de la batterie de conformité…" });
    try {
      const report = await runSelftestCore();
      setPublishResult(
        report.failed > 0
          ? { ok: false, message: `Publié, mais ${report.failed}/${report.total} test(s) en échec (voir Auto-test).` }
          : { ok: true, message: `Publié — auto-test : ${report.passed}/${report.total} réussis.` }
      );
    } catch (e) {
      setPublishResult({
        ok: false,
        message: `Publié, mais l'auto-test n'a pas pu être lancé : ${e instanceof Error ? e.message : "erreur"}`,
      });
    } finally {
      setPublishBusy(false);
    }
  }, [config, loadConfig, runSelftestCore]);

  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="text-2xl font-bold mb-2">Assistant</h1>
      <p className="text-sm text-chanv-terre/60 mb-6">
        Console d&apos;administration du bot public bleuh-chat — configuration, bac à sable, conformité, transcripts.
      </p>

      <div className="flex gap-2 mb-6 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={t.id === tab ? "btn-primary" : "btn-secondary"}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className={tab === "config" ? "" : "hidden"}>
        <AssistantConfigForm
          config={config}
          legalCore={legalCore}
          loading={configLoading}
          loadError={configLoadError}
          canWrite={canWrite}
          publishBusy={publishBusy}
          publishResult={publishResult}
          onChange={handleConfigChange}
          onPublish={() => void handlePublish()}
        />
      </div>

      <div className={tab === "sandbox" ? "" : "hidden"}>
        <AssistantSandbox config={config} canWrite={canWrite} />
      </div>

      <div className={tab === "selftest" ? "" : "hidden"}>
        <AssistantSelftest
          report={selftestReport}
          busy={selftestBusy}
          result={selftestResult}
          canWrite={canWrite}
          onRun={handleSelftestClick}
        />
      </div>

      <div className={tab === "data" ? "" : "hidden"}>
        <AssistantTranscriptsStats active={tab === "data"} />
      </div>
    </main>
  );
}
