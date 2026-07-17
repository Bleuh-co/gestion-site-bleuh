"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Subscriber, SubscriberStatus } from "@/lib/infolettre-types";
import { useT } from "@/lib/i18n";

const STATUS_OPTIONS: { value: "" | SubscriberStatus; key: string }[] = [
  { value: "", key: "infolettre.subStatusAll" },
  { value: "active", key: "infolettre.subStatusActive" },
  { value: "unsubscribed", key: "infolettre.subStatusUnsubscribed" },
  { value: "unconfirmed", key: "infolettre.subStatusUnconfirmed" },
  { value: "bounced", key: "infolettre.subStatusBounced" },
  { value: "junk", key: "infolettre.subStatusJunk" },
];

const STATUS_KEY: Record<string, string> = {
  active: "infolettre.subStatusActive",
  unsubscribed: "infolettre.subStatusUnsubscribed",
  unconfirmed: "infolettre.subStatusUnconfirmed",
  bounced: "infolettre.subStatusBounced",
  junk: "infolettre.subStatusJunk",
};

function statusPillClass(status: string): string {
  switch (status) {
    case "active":
      return "bg-emerald-100 text-emerald-700";
    case "unsubscribed":
      return "bg-gray-200 text-gray-600";
    case "unconfirmed":
      return "bg-amber-100 text-amber-700";
    case "bounced":
      return "bg-rose-100 text-rose-700";
    case "junk":
      return "bg-orange-100 text-orange-700";
    default:
      return "bg-gray-100 text-gray-600";
  }
}

function firstFields(fields: Subscriber["fields"], n: number): string {
  const entries = Object.entries(fields || {}).filter(
    ([, v]) => v !== null && v !== undefined && String(v).trim() !== ""
  );
  return entries
    .slice(0, n)
    .map(([k, v]) => `${k}: ${v}`)
    .join(" · ");
}

function fmtDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-CA");
}

interface SubscriberTableProps {
  /** URL de base (sans query) vers l'endpoint abonnés. */
  fetchUrl: string;
  /**
   * true = pagination par cursor (offset) avec bouton « Charger plus » (données live).
   * false = pagination page/prev/next (snapshot en mémoire).
   */
  cursorMode?: boolean;
}

export function SubscriberTable({ fetchUrl, cursorMode = false }: SubscriberTableProps) {
  const t = useT();
  const [rows, setRows] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState<number | null>(null);

  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [status, setStatus] = useState<"" | SubscriberStatus>("");

  // Cursor mode
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  // Page mode
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const reqId = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => setSearchDebounced(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(
    async (opts: { cursor?: string | null; page?: number; append?: boolean }) => {
      const id = ++reqId.current;
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (searchDebounced) params.set("search", searchDebounced);
      if (status) params.set("status", status);
      if (cursorMode) {
        if (opts.cursor) params.set("cursor", opts.cursor);
      } else {
        params.set("page", String(opts.page ?? 1));
      }
      params.set("limit", "50");
      try {
        const res = await fetch(`${fetchUrl}?${params.toString()}`, { cache: "no-store" });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || t("infolettre.errorHttp", { status: res.status }));
        }
        const data = await res.json();
        if (id !== reqId.current) return; // réponse périmée
        const list: Subscriber[] = data.data ?? [];
        setRows((prev) => (opts.append ? [...prev, ...list] : list));
        setTotal(typeof data.total === "number" ? data.total : null);
        if (cursorMode) {
          setNextCursor(data.nextCursor ?? null);
        } else {
          setPage(data.page ?? 1);
          setTotalPages(data.totalPages ?? 1);
        }
      } catch (e) {
        if (id === reqId.current) {
          setError(e instanceof Error ? e.message : t("infolettre.subLoadError"));
        }
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    },
    [fetchUrl, searchDebounced, status, cursorMode, t]
  );

  // Reset + reload quand les filtres changent
  useEffect(() => {
    setRows([]);
    if (cursorMode) load({ cursor: null, append: false });
    else load({ page: 1, append: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchDebounced, status, fetchUrl]);

  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-4">
        <input
          className="input flex-1 min-w-[180px]"
          placeholder={t("infolettre.subSearchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="input w-auto"
          value={status}
          onChange={(e) => setStatus(e.target.value as "" | SubscriberStatus)}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {t(o.key)}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 mb-4">
          {error}
        </div>
      )}

      {total !== null && (
        <p className="text-sm text-chanv-terre/60 mb-3">
          {t(total > 1 ? "infolettre.subCountPlural" : "infolettre.subCountSingular", {
            n: total.toLocaleString("fr-CA"),
          })}
          {cursorMode ? ` ${t("infolettre.subCountEstimation")}` : ""}
        </p>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-chanv-terre/60 border-b border-black/5">
              <th className="px-4 py-3 font-semibold">{t("infolettre.subColEmail")}</th>
              <th className="px-4 py-3 font-semibold">{t("infolettre.subColStatus")}</th>
              <th className="px-4 py-3 font-semibold whitespace-nowrap">{t("infolettre.subColSubscribedAt")}</th>
              <th className="px-4 py-3 font-semibold hidden md:table-cell">{t("infolettre.subColGroups")}</th>
              <th className="px-4 py-3 font-semibold hidden lg:table-cell">{t("infolettre.subColFields")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  {t("infolettre.subEmpty")}
                </td>
              </tr>
            ) : (
              rows.map((s) => (
                <tr key={s.id} className="border-b border-black/5 last:border-0 align-top">
                  <td className="px-4 py-3 font-mono text-xs break-all">{s.email}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${statusPillClass(
                        s.status
                      )}`}
                    >
                      {STATUS_KEY[s.status] ? t(STATUS_KEY[s.status]) : s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-chanv-terre/60">
                    {fmtDate(s.subscribedAt || s.createdAt)}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-chanv-terre/60">
                    {(s.groups || []).length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {s.groups.slice(0, 4).map((g) => (
                          <span key={g} className="badge-neutral text-[10px]">
                            {g}
                          </span>
                        ))}
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-chanv-terre/50 text-xs">
                    {firstFields(s.fields, 3) || "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {loading && <div className="text-center text-gray-400 text-sm py-4">{t("infolettre.loading")}</div>}

      {/* Pagination */}
      {cursorMode
        ? nextCursor && (
            <div className="text-center mt-4">
              <button
                className="btn-secondary"
                disabled={loading}
                onClick={() => load({ cursor: nextCursor, append: true })}
              >
                {t("infolettre.subLoadMore")}
              </button>
            </div>
          )
        : totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-4">
              <button
                className="btn-secondary"
                disabled={loading || page <= 1}
                onClick={() => load({ page: page - 1, append: false })}
              >
                {t("infolettre.subPrev")}
              </button>
              <span className="text-sm text-chanv-terre/60">
                {t("infolettre.subPageOf", { page, total: totalPages })}
              </span>
              <button
                className="btn-secondary"
                disabled={loading || page >= totalPages}
                onClick={() => load({ page: page + 1, append: false })}
              >
                {t("infolettre.subNext")}
              </button>
            </div>
          )}
    </div>
  );
}
