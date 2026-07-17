"use client";

import { useState } from "react";
import { outilsDownload, outilsDownloadPost, outilsFetch, resultMessage, type ResultBanner } from "./outils-types";
import { OutilsResultBanner } from "./OutilsResultBanner";
import { useT } from "@/lib/i18n";

/** Section 5 — Outils groupés (geocode, mailerlite, courriel, uploads, chatpot). Gestionnaire+. */
export function OutilsToolsCard() {
  const t = useT();
  // Géocodage Ontario
  const [geoBusy, setGeoBusy] = useState<"run" | "reset" | null>(null);
  const [geoResult, setGeoResult] = useState<ResultBanner>(null);
  const runGeocode = async (reset: boolean) => {
    if (reset && !window.confirm(t("outils.confirmResetGeocode"))) {
      return;
    }
    setGeoBusy(reset ? "reset" : "run");
    setGeoResult(null);
    try {
      const data = await outilsFetch(`/tools/geocode-ontario${reset ? "?reset=1" : ""}`, { method: "POST" });
      setGeoResult({ ok: true, message: resultMessage(data) });
    } catch (e) {
      setGeoResult({ ok: false, message: e instanceof Error ? e.message : t("outils.errorGeneric") });
    } finally {
      setGeoBusy(null);
    }
  };

  // Courriel contenu manquant
  const [missingBusy, setMissingBusy] = useState(false);
  const [missingResult, setMissingResult] = useState<ResultBanner>(null);
  const runMissingLotsEmail = async () => {
    if (!window.confirm(t("outils.confirmMissingEmail"))) return;
    setMissingBusy(true);
    setMissingResult(null);
    try {
      const data = await outilsFetch("/tools/missing-lots-email", { method: "POST" });
      setMissingResult({ ok: true, message: resultMessage(data) });
    } catch (e) {
      setMissingResult({ ok: false, message: e instanceof Error ? e.message : t("outils.errorGeneric") });
    } finally {
      setMissingBusy(false);
    }
  };

  // Brouillon MailerLite
  const [mlBusy, setMlBusy] = useState<"preview" | "create" | null>(null);
  const [mlResult, setMlResult] = useState<ResultBanner>(null);
  const [mlPreviewHtml, setMlPreviewHtml] = useState<string | null>(null);
  const runMailerlite = async (dry: boolean) => {
    if (!dry && !window.confirm(t("outils.confirmMailerlite"))) {
      return;
    }
    setMlBusy(dry ? "preview" : "create");
    setMlResult(null);
    if (dry) setMlPreviewHtml(null);
    try {
      const data = await outilsFetch(`/tools/mailerlite-draft${dry ? "?dry=1" : ""}`, { method: "POST" });
      if (dry) {
        const html = data?.html || data?.preview || data?.content;
        if (typeof html === "string" && html) setMlPreviewHtml(html);
      }
      setMlResult({ ok: true, message: resultMessage(data) });
    } catch (e) {
      setMlPreviewHtml(null);
      setMlResult({ ok: false, message: e instanceof Error ? e.message : t("outils.errorGeneric") });
    } finally {
      setMlBusy(null);
    }
  };

  // Upload CSV inventaire Web de secours
  const [invFile, setInvFile] = useState<File | null>(null);
  const [invBusy, setInvBusy] = useState(false);
  const [invResult, setInvResult] = useState<ResultBanner>(null);
  const runInventoryUpload = async () => {
    if (!invFile) {
      setInvResult({ ok: false, message: t("outils.chooseCsv") });
      return;
    }
    setInvBusy(true);
    setInvResult(null);
    try {
      const fd = new FormData();
      fd.append("csv_file", invFile);
      const data = await outilsFetch("/tools/inventory-web-upload", { method: "POST", body: fd });
      setInvResult({ ok: true, message: resultMessage(data) });
      setInvFile(null);
    } catch (e) {
      setInvResult({ ok: false, message: e instanceof Error ? e.message : t("outils.errorGeneric") });
    } finally {
      setInvBusy(false);
    }
  };

  // CSV MetroGreen
  const [mgBusy, setMgBusy] = useState(false);
  const [mgResult, setMgResult] = useState<ResultBanner>(null);
  const runMetrogreenCsv = async () => {
    setMgBusy(true);
    setMgResult(null);
    try {
      await outilsDownload("/tools/metrogreen-csv", "metrogreen.csv");
      setMgResult({ ok: true, message: t("outils.downloadStarted") });
    } catch (e) {
      setMgResult({ ok: false, message: e instanceof Error ? e.message : t("outils.errorGeneric") });
    } finally {
      setMgBusy(false);
    }
  };

  // ChatPot : upload XLSX → PDF
  const [chatpotFile, setChatpotFile] = useState<File | null>(null);
  const [chatpotBusy, setChatpotBusy] = useState(false);
  const [chatpotResult, setChatpotResult] = useState<ResultBanner>(null);
  const runChatpot = async () => {
    if (!chatpotFile) {
      setChatpotResult({ ok: false, message: t("outils.chooseXlsx") });
      return;
    }
    setChatpotBusy(true);
    setChatpotResult(null);
    try {
      const fd = new FormData();
      fd.append("xlsx", chatpotFile);
      await outilsDownloadPost("/chatpot", fd, "chatpot.pdf");
      setChatpotResult({ ok: true, message: t("outils.downloadStarted") });
      setChatpotFile(null);
    } catch (e) {
      setChatpotResult({ ok: false, message: e instanceof Error ? e.message : t("outils.errorGeneric") });
    } finally {
      setChatpotBusy(false);
    }
  };

  return (
    <section className="card p-4 space-y-6">
      <div>
        <h2 className="text-lg font-semibold">{t("outils.pageTitle")}</h2>
        <p className="text-sm text-chanv-terre/70">{t("outils.toolsIntro")}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-chanv-terre/70">{t("outils.geocodeTitle")}</h3>
          <div className="flex gap-2 flex-wrap">
            <button type="button" className="btn-secondary" disabled={geoBusy !== null} onClick={() => void runGeocode(false)}>
              {geoBusy === "run" ? t("outils.launching") : t("outils.run")}
            </button>
            <button
              type="button"
              className="btn-secondary text-rose-600"
              disabled={geoBusy !== null}
              onClick={() => void runGeocode(true)}
            >
              {geoBusy === "reset" ? t("outils.resetting") : t("outils.reset")}
            </button>
          </div>
          <OutilsResultBanner result={geoResult} />
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-chanv-terre/70">{t("outils.missingEmailTitle")}</h3>
          <button type="button" className="btn-secondary" disabled={missingBusy} onClick={() => void runMissingLotsEmail()}>
            {missingBusy ? t("outils.sending") : t("outils.sendEmail")}
          </button>
          <OutilsResultBanner result={missingResult} />
        </div>

        <div className="space-y-2 lg:col-span-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-chanv-terre/70">{t("outils.mailerliteTitle")}</h3>
          <div className="flex gap-2 flex-wrap">
            <button type="button" className="btn-secondary" disabled={mlBusy !== null} onClick={() => void runMailerlite(true)}>
              {mlBusy === "preview" ? t("outils.previewing") : t("outils.preview")}
            </button>
            <button type="button" className="btn-primary" disabled={mlBusy !== null} onClick={() => void runMailerlite(false)}>
              {mlBusy === "create" ? t("outils.creating") : t("outils.createDraft")}
            </button>
          </div>
          <OutilsResultBanner result={mlResult} />
          {mlPreviewHtml && (
            <iframe title={t("outils.mailerlitePreview")} srcDoc={mlPreviewHtml} className="w-full h-96 rounded-xl border border-chanv-fibre bg-white" />
          )}
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-chanv-terre/70">
            {t("outils.inventoryWebTitle")}
          </h3>
          <input
            className="input"
            type="file"
            accept=".csv"
            onChange={(e) => setInvFile(e.target.files?.[0] ?? null)}
          />
          <button type="button" className="btn-secondary" disabled={invBusy} onClick={() => void runInventoryUpload()}>
            {invBusy ? t("outils.importing") : t("outils.import")}
          </button>
          <OutilsResultBanner result={invResult} />
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-chanv-terre/70">{t("outils.metrogreenTitle")}</h3>
          <button type="button" className="btn-secondary" disabled={mgBusy} onClick={() => void runMetrogreenCsv()}>
            {mgBusy ? t("outils.downloading") : t("outils.downloadCsv")}
          </button>
          <OutilsResultBanner result={mgResult} />
        </div>

        <div className="space-y-2 lg:col-span-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-chanv-terre/70">{t("outils.chatpotTitle")}</h3>
          <input
            className="input"
            type="file"
            accept=".xlsx"
            onChange={(e) => setChatpotFile(e.target.files?.[0] ?? null)}
          />
          <button type="button" className="btn-secondary" disabled={chatpotBusy} onClick={() => void runChatpot()}>
            {chatpotBusy ? t("outils.generating") : t("outils.generatePdf")}
          </button>
          <OutilsResultBanner result={chatpotResult} />
        </div>
      </div>
    </section>
  );
}
