"use client";

import type { ResultBanner } from "./outils-types";

export function OutilsResultBanner({ result }: { result: ResultBanner }) {
  if (!result) return null;
  return (
    <div
      className={`rounded-xl border px-4 py-3 text-sm ${
        result.ok ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"
      }`}
    >
      {result.message}
    </div>
  );
}
