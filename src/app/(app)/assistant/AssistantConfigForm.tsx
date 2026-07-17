"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n";
import type { AssistantConfig, FaqItem, LegalCore, ResultBanner } from "./assistant-types";

interface AssistantConfigFormProps {
  config: AssistantConfig;
  legalCore: LegalCore;
  loading: boolean;
  loadError: string | null;
  canWrite: boolean;
  publishBusy: boolean;
  publishResult: ResultBanner;
  onChange: (patch: Partial<AssistantConfig>) => void;
  onPublish: () => void;
}

const splitLines = (v: string) =>
  v
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

const numOrUndefined = (raw: string, float = false): number | undefined => {
  if (raw.trim() === "") return undefined;
  const n = float ? parseFloat(raw) : parseInt(raw, 10);
  return Number.isFinite(n) ? n : undefined;
};

function fmtDate(v: string | undefined): string {
  if (!v) return "?";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleString("fr-CA");
}

export function AssistantConfigForm({
  config,
  legalCore,
  loading,
  loadError,
  canWrite,
  publishBusy,
  publishResult,
  onChange,
  onPublish,
}: AssistantConfigFormProps) {
  const t = useT();
  const [legalOpen, setLegalOpen] = useState(false);

  const updateFaq = (index: number, patch: Partial<FaqItem>) => {
    const faq = config.faq.map((item, i) => (i === index ? { ...item, ...patch } : item));
    onChange({ faq });
  };
  const addFaq = () => onChange({ faq: [...config.faq, { q_fr: "", a_fr: "", q_en: "", a_en: "" }] });
  const removeFaq = (index: number) => onChange({ faq: config.faq.filter((_, i) => i !== index) });

  return (
    <div className="space-y-6">
      {loadError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{loadError}</div>
      )}

      <div className="card p-4 flex items-center justify-between flex-wrap gap-2">
        <span className="text-sm text-chanv-terre/60">
          {config.version && config.version > 0
            ? t("assistant.configVersionInfo", {
                version: config.version,
                by: config.updatedBy || "?",
                date: fmtDate(config.updatedAt),
              })
            : t("assistant.noVersionPublished")}
        </span>
        {loading && <span className="text-sm text-chanv-terre/40">{t("assistant.loading")}</span>}
      </div>

      {/* Champs de config verrouillés en lecture seule pour un consultant —
          cohérent avec sandbox/selftest ; la publication reste gardée serveur
          (requireWrite). Le socle légal (lecture) et « Publier » restent hors du
          fieldset. */}
      <fieldset disabled={!canWrite} className="space-y-6 min-w-0 border-0 p-0 m-0">
      <div className="card p-4 grid gap-4 sm:grid-cols-2">
        <div className="flex items-center gap-2">
          <input
            id="assistant-enabled"
            type="checkbox"
            checked={config.enabled !== false}
            onChange={(e) => onChange({ enabled: e.target.checked })}
          />
          <label htmlFor="assistant-enabled" className="label mb-0">
            {t("assistant.enabledLabel")}
          </label>
        </div>
        <div>
          <label className="label">{t("assistant.modelLabel")}</label>
          <input className="input" value={config.model} onChange={(e) => onChange({ model: e.target.value })} />
        </div>
        <div>
          <label className="label">{t("assistant.escalationEmailLabel")}</label>
          <input
            className="input"
            type="email"
            value={config.escalationEmail}
            onChange={(e) => onChange({ escalationEmail: e.target.value })}
          />
        </div>
      </div>

      <div className="card p-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">{t("assistant.identityFr")}</label>
          <textarea
            className="input"
            rows={3}
            value={config.identity_fr}
            onChange={(e) => onChange({ identity_fr: e.target.value })}
          />
        </div>
        <div>
          <label className="label">{t("assistant.identityEn")}</label>
          <textarea
            className="input"
            rows={3}
            value={config.identity_en}
            onChange={(e) => onChange({ identity_en: e.target.value })}
          />
        </div>
        <div>
          <label className="label">{t("assistant.toneFr")}</label>
          <textarea
            className="input"
            rows={2}
            value={config.tone_fr}
            onChange={(e) => onChange({ tone_fr: e.target.value })}
          />
        </div>
        <div>
          <label className="label">{t("assistant.toneEn")}</label>
          <textarea
            className="input"
            rows={2}
            value={config.tone_en}
            onChange={(e) => onChange({ tone_en: e.target.value })}
          />
        </div>
        <div>
          <label className="label">{t("assistant.startersFr")}</label>
          <textarea
            className="input"
            rows={4}
            value={config.starters_fr.join("\n")}
            onChange={(e) => onChange({ starters_fr: splitLines(e.target.value) })}
          />
        </div>
        <div>
          <label className="label">{t("assistant.startersEn")}</label>
          <textarea
            className="input"
            rows={4}
            value={config.starters_en.join("\n")}
            onChange={(e) => onChange({ starters_en: splitLines(e.target.value) })}
          />
        </div>
      </div>

      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="label mb-0">{t("assistant.faqTitle")}</span>
          <button type="button" className="btn-secondary" onClick={addFaq}>
            {t("assistant.addQuestion")}
          </button>
        </div>
        <div className="space-y-3">
          {config.faq.length === 0 && <p className="text-sm text-chanv-terre/40">{t("assistant.noFaq")}</p>}
          {config.faq.map((item, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-5 items-start border border-chanv-fibre rounded-xl p-3">
              <input
                className="input"
                placeholder={t("assistant.faqQuestionFrPlaceholder")}
                value={item.q_fr}
                onChange={(e) => updateFaq(i, { q_fr: e.target.value })}
              />
              <input
                className="input"
                placeholder={t("assistant.faqAnswerFrPlaceholder")}
                value={item.a_fr}
                onChange={(e) => updateFaq(i, { a_fr: e.target.value })}
              />
              <input
                className="input"
                placeholder={t("assistant.faqQuestionEnPlaceholder")}
                value={item.q_en}
                onChange={(e) => updateFaq(i, { q_en: e.target.value })}
              />
              <input
                className="input"
                placeholder={t("assistant.faqAnswerEnPlaceholder")}
                value={item.a_en}
                onChange={(e) => updateFaq(i, { a_en: e.target.value })}
              />
              <button type="button" className="btn-secondary" onClick={() => removeFaq(i)}>
                {t("assistant.remove")}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="card p-4 grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <div>
          <label className="label">{t("assistant.dailyBudgetLabel")}</label>
          <input
            className="input"
            type="number"
            step="0.01"
            value={config.dailyBudgetUsd ?? ""}
            onChange={(e) => onChange({ dailyBudgetUsd: numOrUndefined(e.target.value, true) })}
          />
        </div>
        <div>
          <label className="label">{t("assistant.maxMessagesLabel")}</label>
          <input
            className="input"
            type="number"
            value={config.maxMessagesPerSession ?? ""}
            onChange={(e) => onChange({ maxMessagesPerSession: numOrUndefined(e.target.value) })}
          />
        </div>
        <div>
          <label className="label">{t("assistant.maxRequestsLabel")}</label>
          <input
            className="input"
            type="number"
            value={config.maxRequestsPerHourPerIp ?? ""}
            onChange={(e) => onChange({ maxRequestsPerHourPerIp: numOrUndefined(e.target.value) })}
          />
        </div>
        <div>
          <label className="label">{t("assistant.maxInputLabel")}</label>
          <input
            className="input"
            type="number"
            value={config.maxInputChars ?? ""}
            onChange={(e) => onChange({ maxInputChars: numOrUndefined(e.target.value) })}
          />
        </div>
        <div>
          <label className="label">{t("assistant.maxOutputLabel")}</label>
          <input
            className="input"
            type="number"
            value={config.maxOutputTokens ?? ""}
            onChange={(e) => onChange({ maxOutputTokens: numOrUndefined(e.target.value) })}
          />
        </div>
      </div>
      </fieldset>

      <div className="card p-4">
        <button
          type="button"
          className="btn-ghost text-sm"
          onClick={() => setLegalOpen((v) => !v)}
          aria-expanded={legalOpen}
        >
          {legalOpen ? "▾" : "▸"} {t("assistant.legalCore")}
        </button>
        {legalOpen && (
          <div className="grid gap-4 sm:grid-cols-2 mt-3">
            <pre className="whitespace-pre-wrap text-xs text-chanv-terre/70 bg-chanv-fibre/50 rounded-xl p-3">
              {legalCore.fr || "—"}
            </pre>
            <pre className="whitespace-pre-wrap text-xs text-chanv-terre/70 bg-chanv-fibre/50 rounded-xl p-3">
              {legalCore.en || "—"}
            </pre>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <button type="button" className="btn-primary" disabled={!canWrite || publishBusy} onClick={onPublish}>
          {publishBusy ? t("assistant.publishing") : t("assistant.publish")}
        </button>
        {!canWrite && <span className="text-sm text-chanv-terre/40">{t("assistant.readOnlyForRole")}</span>}
      </div>

      {publishResult && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            publishResult.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          {publishResult.message}
        </div>
      )}
    </div>
  );
}
