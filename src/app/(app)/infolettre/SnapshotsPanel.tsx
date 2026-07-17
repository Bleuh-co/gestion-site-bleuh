"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MLGroup, SnapshotDoc, SnapshotStatus } from "@/lib/infolettre-types";
import { SubscriberTable } from "./SubscriberTable";
import { useT } from "@/lib/i18n";

interface SnapshotsPanelProps {
  canWrite: boolean;
}

const STATUS_KEY: Record<SnapshotStatus, string> = {
  pending: "infolettre.snapStatusPending",
  running: "infolettre.snapStatusRunning",
  done: "infolettre.snapStatusDone",
  failed: "infolettre.snapStatusFailed",
};

function statusPill(status: SnapshotStatus): string {
  switch (status) {
    case "done":
      return "bg-emerald-100 text-emerald-700";
    case "running":
    case "pending":
      return "bg-amber-100 text-amber-700";
    case "failed":
      return "bg-rose-100 text-rose-700";
    default:
      return "bg-gray-100 text-gray-600";
  }
}

function fmtDateTime(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("fr-CA");
}

export function SnapshotsPanel({ canWrite }: SnapshotsPanelProps) {
  const t = useT();
  const [list, setList] = useState<SnapshotDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/infolettre/snapshots", { cache: "no-store" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || t("infolettre.errorHttp", { status: res.status }));
      }
      setList(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : t("infolettre.snapListError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Auto-refresh tant qu'une copie tourne
  const hasActive = list.some((s) => s.status === "running" || s.status === "pending");
  useEffect(() => {
    if (!hasActive || selectedId) return;
    const timer = setInterval(refresh, 3000);
    return () => clearInterval(timer);
  }, [hasActive, selectedId, refresh]);

  if (selectedId) {
    return (
      <SnapshotDetail
        id={selectedId}
        canWrite={canWrite}
        onBack={() => {
          setSelectedId(null);
          refresh();
        }}
      />
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <h2 className="text-lg font-bold">{t("infolettre.snapListTitle")}</h2>
        {canWrite && !showForm && (
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            {t("infolettre.snapCreateBtn")}
          </button>
        )}
      </div>

      {showForm && (
        <SnapshotCreateForm
          onDone={() => {
            setShowForm(false);
            refresh();
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 mb-4">
          {error}
        </div>
      )}

      {loading && list.length === 0 ? (
        <div className="card p-8 text-center text-gray-400">{t("infolettre.loading")}</div>
      ) : list.length === 0 ? (
        <div className="card p-8 text-center text-gray-400">
          {t("infolettre.snapEmpty")}
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-chanv-terre/60 border-b border-black/5">
                <th className="px-4 py-3 font-semibold">{t("infolettre.snapColName")}</th>
                <th className="px-4 py-3 font-semibold">{t("infolettre.snapColStatus")}</th>
                <th className="px-4 py-3 font-semibold whitespace-nowrap">{t("infolettre.snapColSubscribers")}</th>
                <th className="px-4 py-3 font-semibold whitespace-nowrap hidden md:table-cell">{t("infolettre.snapColCreatedAt")}</th>
                <th className="px-4 py-3 font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {list.map((s) => (
                <tr key={s.id} className="border-b border-black/5 last:border-0">
                  <td className="px-4 py-3">
                    <button
                      className="text-left font-medium hover:underline"
                      onClick={() => setSelectedId(s.id)}
                    >
                      {s.label}
                    </button>
                    {s.scope === "group" && s.groupName && (
                      <span className="ml-2 badge-neutral text-[10px]">{s.groupName}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${statusPill(
                        s.status
                      )}`}
                    >
                      {t(STATUS_KEY[s.status])}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-chanv-terre/60">
                    {s.status === "running" || s.status === "pending"
                      ? `${s.fetchedSubscribers} / ${s.totalSubscribers || "?"}`
                      : (s.totalSubscribers || 0).toLocaleString("fr-CA")}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-chanv-terre/60 hidden md:table-cell">
                    {fmtDateTime(s.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button className="btn-ghost" onClick={() => setSelectedId(s.id)}>
                      {t("infolettre.snapOpen")}
                    </button>
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

// ─── Formulaire de création (avec progression SSE) ──────────────

function SnapshotCreateForm({
  onDone,
  onCancel,
}: {
  onDone: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const [groups, setGroups] = useState<MLGroup[]>([]);
  const [scope, setScope] = useState<"all" | "group">("all");
  const [groupId, setGroupId] = useState("");
  const [label, setLabel] = useState("");

  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("");
  const [percent, setPercent] = useState(0);
  const [fetched, setFetched] = useState(0);
  const [totalSubs, setTotalSubs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const startedAt = useRef<number>(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    fetch("/api/infolettre/groups", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((g) => setGroups(Array.isArray(g) ? g : []))
      .catch(() => setGroups([]));
  }, []);

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setElapsed(Math.round((Date.now() - startedAt.current) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [running]);

  const start = useCallback(async () => {
    setRunning(true);
    setError(null);
    setStatus(t("infolettre.snapFormStarting"));
    setPercent(0);
    setFetched(0);
    startedAt.current = Date.now();
    try {
      const res = await fetch("/api/infolettre/snapshots/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope,
          groupId: scope === "group" ? groupId : undefined,
          label: label || undefined,
        }),
      });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || t("infolettre.errorHttp", { status: res.status }));
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let done = false;
      while (!done) {
        const { value, done: rdDone } = await reader.read();
        done = rdDone;
        buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const block of parts) {
          let event = "";
          let data = "";
          for (const line of block.split("\n")) {
            if (line.startsWith("event:")) event = line.slice(6).trim();
            else if (line.startsWith("data:")) data += line.slice(5).trim();
          }
          if (!event || !data) continue;
          let payload: Record<string, unknown> = {};
          try {
            payload = JSON.parse(data);
          } catch {
            continue;
          }
          if (event === "status") {
            setStatus(String(payload.message ?? ""));
          } else if (event === "created") {
            setStatus(t("infolettre.snapFormCopying"));
            setTotalSubs(Number(payload.totalSubscribers ?? 0));
          } else if (event === "progress") {
            setFetched(Number(payload.fetched ?? 0));
            setTotalSubs(Number(payload.total ?? 0));
            setPercent(Number(payload.percent ?? 0));
          } else if (event === "completed") {
            setPercent(100);
            setStatus(t("infolettre.snapFormDone"));
            setFetched(Number(payload.totalSubscribers ?? 0));
          } else if (event === "error") {
            setError(String(payload.message ?? t("infolettre.snapFormUnknownError")));
          }
        }
      }
      if (!error) {
        setTimeout(onDone, 800);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("infolettre.snapFormCreateError"));
    } finally {
      setRunning(false);
    }
  }, [scope, groupId, label, error, onDone, t]);

  return (
    <div className="section-card mb-6">
      <h3 className="font-bold mb-4">{t("infolettre.snapFormTitle")}</h3>

      {!running && percent === 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">{t("infolettre.snapFormScope")}</label>
            <select
              className="input"
              value={scope}
              onChange={(e) => setScope(e.target.value as "all" | "group")}
            >
              <option value="all">{t("infolettre.snapFormScopeAll")}</option>
              <option value="group">{t("infolettre.snapFormScopeGroup")}</option>
            </select>
          </div>
          {scope === "group" && (
            <div>
              <label className="label">{t("infolettre.snapFormGroup")}</label>
              <select className="input" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
                <option value="">{t("infolettre.snapFormChoose")}</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({g.activeCount})
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="sm:col-span-2">
            <label className="label">{t("infolettre.snapFormName")}</label>
            <input
              className="input"
              placeholder={t("infolettre.snapFormNamePlaceholder")}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2 flex gap-3">
            <button
              className="btn-primary"
              disabled={scope === "group" && !groupId}
              onClick={start}
            >
              {t("infolettre.snapFormLaunch")}
            </button>
            <button className="btn-secondary" onClick={onCancel}>
              {t("infolettre.snapFormCancel")}
            </button>
          </div>
        </div>
      ) : (
        <div>
          <p className="text-sm text-chanv-terre/70 mb-2">{status}</p>
          <div className="h-3 w-full rounded-full bg-black/10 overflow-hidden mb-2">
            <div
              className="h-full bg-emerald-500 transition-all"
              style={{ width: `${Math.min(percent, 100)}%` }}
            />
          </div>
          <p className="text-xs text-chanv-terre/60">
            {fetched.toLocaleString("fr-CA")}
            {totalSubs ? ` / ${totalSubs.toLocaleString("fr-CA")}` : ""}{" "}
            {t("infolettre.snapProgressStats", { percent, elapsed })}
          </p>
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 mt-3">
              {error}
            </div>
          )}
          {(error || percent >= 100) && !running && (
            <button className="btn-secondary mt-4" onClick={onDone}>
              {t("infolettre.snapFormClose")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Détail d'une copie ─────────────────────────────────────────

function SnapshotDetail({
  id,
  canWrite,
  onBack,
}: {
  id: string;
  canWrite: boolean;
  onBack: () => void;
}) {
  const t = useT();
  const [snap, setSnap] = useState<SnapshotDoc | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/infolettre/snapshots/${id}`, { cache: "no-store" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || t("infolettre.errorHttp", { status: res.status }));
      }
      setSnap(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : t("infolettre.snapDetailLoadError"));
    }
  }, [id, t]);

  useEffect(() => {
    load();
  }, [load]);

  // Poll tant que la copie tourne
  const active = snap?.status === "running" || snap?.status === "pending";
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(load, 3000);
    return () => clearInterval(timer);
  }, [active, load]);

  const remove = useCallback(async () => {
    if (!confirm(t("infolettre.snapDeleteConfirm"))) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/infolettre/snapshots/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || t("infolettre.errorHttp", { status: res.status }));
      }
      onBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("infolettre.snapDeleteError"));
      setDeleting(false);
    }
  }, [id, onBack, t]);

  return (
    <div>
      <button className="btn-ghost mb-4" onClick={onBack}>
        {t("infolettre.snapBackToList")}
      </button>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 mb-4">
          {error}
        </div>
      )}

      {!snap ? (
        <div className="card p-8 text-center text-gray-400">{t("infolettre.loading")}</div>
      ) : (
        <>
          <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
            <div>
              <h2 className="text-lg font-bold">{snap.label}</h2>
              <p className="text-sm text-chanv-terre/60">
                {t("infolettre.snapDetailMeta", {
                  account: snap.accountLabel,
                  date: fmtDateTime(snap.createdAt),
                })}
              </p>
            </div>
            <span
              className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${statusPill(
                snap.status
              )}`}
            >
              {t(STATUS_KEY[snap.status])}
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-6">
            <div className="card p-4">
              <p className="text-xs text-chanv-terre/60">{t("infolettre.snapStatCopied")}</p>
              <p className="text-xl font-bold">{snap.fetchedSubscribers.toLocaleString("fr-CA")}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-chanv-terre/60">{t("infolettre.snapStatExpected")}</p>
              <p className="text-xl font-bold">{snap.totalSubscribers.toLocaleString("fr-CA")}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-chanv-terre/60">{t("infolettre.snapStatScope")}</p>
              <p className="text-xl font-bold">
                {snap.scope === "group"
                  ? snap.groupName || t("infolettre.snapFormGroup")
                  : t("infolettre.snapScopeAll")}
              </p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-chanv-terre/60">{t("infolettre.snapStatBy")}</p>
              <p className="text-sm font-medium break-all">{snap.createdByEmail}</p>
            </div>
          </div>

          {active && (
            <div className="mb-6">
              <div className="h-3 w-full rounded-full bg-black/10 overflow-hidden mb-1">
                <div
                  className="h-full bg-emerald-500 transition-all"
                  style={{
                    width: `${
                      snap.totalSubscribers
                        ? Math.min(99, Math.round((snap.fetchedSubscribers / snap.totalSubscribers) * 100))
                        : 0
                    }%`,
                  }}
                />
              </div>
              <p className="text-xs text-chanv-terre/60">{t("infolettre.snapFormCopying")}</p>
            </div>
          )}

          {snap.status === "failed" && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 mb-6">
              {t("infolettre.snapFailedMsg")} {snap.errorMessage}
            </div>
          )}

          <div className="flex flex-wrap gap-3 mb-6">
            {snap.status === "done" && canWrite && (
              <>
                <a
                  className="btn-secondary"
                  href={`/api/infolettre/snapshots/${id}/export?format=csv`}
                >
                  {t("infolettre.snapExportCsv")}
                </a>
                <a
                  className="btn-secondary"
                  href={`/api/infolettre/snapshots/${id}/export?format=json`}
                >
                  {t("infolettre.snapExportJson")}
                </a>
              </>
            )}
            {canWrite && (
              <button className="btn-ghost text-rose-600" disabled={deleting} onClick={remove}>
                {deleting ? t("infolettre.snapDeleting") : t("infolettre.snapDelete")}
              </button>
            )}
          </div>

          {snap.status === "done" && (
            <SubscriberTable fetchUrl={`/api/infolettre/snapshots/${id}/subscribers`} />
          )}
        </>
      )}
    </div>
  );
}
