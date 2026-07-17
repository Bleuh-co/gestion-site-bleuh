"use client";

import { useState } from "react";
import { EXPORT_EXTS, outilsDownload, type ResultBanner } from "./outils-types";
import { OutilsResultBanner } from "./OutilsResultBanner";
import { useT } from "@/lib/i18n";

/** Section 3 — Exports (GET /api/outils/exports/rotations.<ext>). Lecture consultant+. */
export function OutilsExportsCard() {
  const t = useT();
  const [province, setProvince] = useState("");
  const [busyExt, setBusyExt] = useState<string | null>(null);
  const [result, setResult] = useState<ResultBanner>(null);

  const download = async (ext: string) => {
    setBusyExt(ext);
    setResult(null);
    try {
      const qs = province ? `?province=${encodeURIComponent(province)}` : "";
      await outilsDownload(`/exports/rotations.${ext}${qs}`, `rotations.${ext}`);
      setResult({ ok: true, message: t("outils.downloadStarted") });
    } catch (e) {
      setResult({ ok: false, message: e instanceof Error ? e.message : t("outils.errorGeneric") });
    } finally {
      setBusyExt(null);
    }
  };

  return (
    <section className="card p-4 space-y-3">
      <div>
        <h2 className="text-lg font-semibold">{t("outils.exportsTitle")}</h2>
        <p className="text-sm text-chanv-terre/70">{t("outils.exportsIntro")}</p>
      </div>

      <div className="flex items-end gap-3 flex-wrap">
        <div className="w-40">
          <label className="label">{t("outils.province")}</label>
          <select className="input" value={province} onChange={(e) => setProvince(e.target.value)}>
            <option value="">{t("outils.provinceAll")}</option>
            <option value="QC">{t("outils.provinceQuebec")}</option>
            <option value="ON">{t("outils.provinceOntario")}</option>
          </select>
        </div>
        <div className="flex gap-2 flex-wrap">
          {EXPORT_EXTS.map(({ ext, label }) => (
            <button
              key={ext}
              type="button"
              className="btn-secondary"
              disabled={busyExt !== null}
              onClick={() => void download(ext)}
            >
              {busyExt === ext ? t("outils.downloading") : label}
            </button>
          ))}
        </div>
      </div>

      <OutilsResultBanner result={result} />
    </section>
  );
}
