"use client";

import { useState } from "react";
import { EXPORT_EXTS, outilsDownload, type ResultBanner } from "./outils-types";
import { OutilsResultBanner } from "./OutilsResultBanner";

/** Section 3 — Exports (GET /api/outils/exports/rotations.<ext>). Lecture consultant+. */
export function OutilsExportsCard() {
  const [province, setProvince] = useState("");
  const [busyExt, setBusyExt] = useState<string | null>(null);
  const [result, setResult] = useState<ResultBanner>(null);

  const download = async (ext: string) => {
    setBusyExt(ext);
    setResult(null);
    try {
      const qs = province ? `?province=${encodeURIComponent(province)}` : "";
      await outilsDownload(`/exports/rotations.${ext}${qs}`, `rotations.${ext}`);
      setResult({ ok: true, message: "Téléchargement lancé." });
    } catch (e) {
      setResult({ ok: false, message: e instanceof Error ? e.message : "Erreur." });
    } finally {
      setBusyExt(null);
    }
  };

  return (
    <section className="card p-4 space-y-3">
      <div>
        <h2 className="text-lg font-semibold">Exports</h2>
        <p className="text-sm text-chanv-terre/70">Export des rotations de produits en boutique.</p>
      </div>

      <div className="flex items-end gap-3 flex-wrap">
        <div className="w-40">
          <label className="label">Province</label>
          <select className="input" value={province} onChange={(e) => setProvince(e.target.value)}>
            <option value="">Toutes</option>
            <option value="QC">Québec</option>
            <option value="ON">Ontario</option>
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
              {busyExt === ext ? "Téléchargement…" : label}
            </button>
          ))}
        </div>
      </div>

      <OutilsResultBanner result={result} />
    </section>
  );
}
