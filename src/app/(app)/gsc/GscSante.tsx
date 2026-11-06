"use client";

/**
 * Santé Google — encart de l'écran Performance Google : le plan du site
 * déclaré à Google, et les vieilles pages que Google montre encore, avec ce
 * qu'il faut faire pour chacune. Jumeau de l'encart de marketing-mdh.
 *
 * Source : la dernière vérification enregistrée (POST /api/gsc/sante, chaque
 * matin par Cloud Scheduler ou par le bouton). Google ne laisse aucun robot
 * « Demander l'indexation » ni « Suppressions » : pour ces deux gestes,
 * l'encart donne l'adresse à copier et le lien de la propriété.
 */

import { useEffect, useMemo, useState } from "react";
import { useLocale, useT } from "@/lib/i18n";
import {
  GSC_PAGE_KINDS,
  bareHost,
  searchConsoleUrl,
  siteOrigin,
  type GscPageKind,
  type GscPageSignal,
  type GscSanteDoc,
} from "@/lib/gsc-sante-pure";

const ROWS_PER_KIND = 10;

/**
 * Adresse lisible : le chemin seul sur le site principal, l'hôte en plus
 * ailleurs (`old.maisondherbes.com/…` ne doit pas se lire comme le site).
 */
function shortUrl(url: string, mainHost: string | null): string {
  const path = url.replace(/^https?:\/\/[^/]+/, "") || "/";
  const host = bareHost(url);
  return host && host !== mainHost ? `${url.replace(/^https?:\/\/(www\.)?/, "").split("/")[0]}${path}` : path;
}

/** Lecture et relance de la vérification ; l'affichage est dans GscSanteVue. */
export function GscSante({ canWrite }: { canWrite: boolean }) {
  const t = useT();
  const [sante, setSante] = useState<GscSanteDoc | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/gsc/sante", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err?.error || `HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((json: { sante: GscSanteDoc | null }) => {
        if (!cancelled) setSante(json.sante);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(`${t("gscSante.loadError")} ${e.message}`);
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
    // t change avec la langue ; relire Firestore pour ça serait inutile.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = () => {
    setRunning(true);
    setError(null);
    fetch("/api/gsc/sante", { method: "POST" })
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err?.error || `HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((json: { sante: GscSanteDoc }) => setSante(json.sante))
      .catch((e: Error) => setError(`${t("gscSante.runError")} ${e.message}`))
      .finally(() => setRunning(false));
  };

  return (
    <GscSanteVue
      sante={sante}
      loaded={loaded}
      error={error}
      running={running}
      canWrite={canWrite}
      onRun={run}
    />
  );
}

/** L'encart lui-même, sans réseau : rendu tel quel à partir d'une vérification. */
export function GscSanteVue({
  sante,
  loaded,
  error,
  running,
  canWrite,
  onRun,
}: {
  sante: GscSanteDoc | null;
  loaded: boolean;
  error: string | null;
  running: boolean;
  canWrite: boolean;
  onRun: () => void;
}) {
  const t = useT();
  const locale = useLocale();
  const nf = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const [expanded, setExpanded] = useState<Partial<Record<GscPageKind, boolean>>>({});
  const [copied, setCopied] = useState<string | null>(null);

  const copy = (url: string) => {
    navigator.clipboard
      ?.writeText(url)
      .then(() => {
        setCopied(url);
        setTimeout(() => setCopied((c) => (c === url ? null : c)), 2000);
      })
      .catch(() => {});
  };

  /** « 2026-11-04 » → « 4 novembre » (jour de Search Console, en UTC). */
  const day = (iso: string) =>
    new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString(locale, {
      day: "numeric",
      month: "long",
      timeZone: "UTC",
    });
  /** Instant de la vérification, à l'heure de Montréal. */
  const moment = (iso: string) =>
    new Date(iso).toLocaleString(locale, {
      day: "numeric",
      month: "long",
      hour: "numeric",
      minute: "2-digit",
      timeZone: "America/Toronto",
    });

  const mainHost = sante ? bareHost(siteOrigin(sante.siteUrl)) : null;
  const short = (url: string) => shortUrl(url, mainHost);

  /** Où mène l'adresse (une URL, coupable n'importe où) et son état (des mots, jamais coupés). */
  const answer = (s: GscPageSignal): { target: string | null; note: string } => {
    if (s.kind === "noindex") return { target: null, note: t("gscSante.answer.noindex") };
    const note =
      s.finalStatus === null
        ? t("gscSante.answer.noResponse")
        : s.finalStatus === 404 || s.finalStatus === 410
          ? t("gscSante.answer.gone", { status: s.finalStatus })
          : s.finalStatus === 200
            ? ""
            : t("gscSante.answer.status", { status: s.finalStatus });
    if (!s.finalUrl) return { target: null, note: note || t("gscSante.answer.served") };
    return { target: short(s.finalUrl), note };
  };
  const answerCell = (s: GscPageSignal) => {
    const { target, note } = answer(s);
    return (
      <>
        {target && <span className="font-mono break-all">→ {target}</span>}
        {target && note && " · "}
        {note && <span className="whitespace-nowrap">{note}</span>}
      </>
    );
  };

  const plan = sante?.plan ?? null;
  const pages = sante?.pages ?? null;
  const groups = GSC_PAGE_KINDS.map((kind) => ({
    kind,
    rows: (pages?.signals ?? []).filter((s) => s.kind === kind),
  })).filter((g) => g.rows.length > 0);
  const unchecked = pages ? pages.shown - pages.checked : 0;

  return (
    <section className="card p-4 mb-6">
      <div className="flex flex-wrap items-center gap-3 mb-2">
        <h2 className="text-base font-semibold m-0">{t("gscSante.title")}</h2>
        {sante && (
          <span className="text-xs text-chanv-terre/60">
            {t("gscSante.checkedAt", { date: moment(sante.checkedAt) })}
          </span>
        )}
        {canWrite && (
          <button
            type="button"
            onClick={onRun}
            disabled={running}
            className="btn btn-secondary ml-auto"
            title={t("gscSante.runHint")}
          >
            {running ? t("gscSante.running") : t("gscSante.run")}
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-700 m-0 mb-2">{error}</p>}
      {loaded && !sante && !error && (
        <p className="text-sm text-chanv-terre/60 m-0">{t("gscSante.never")}</p>
      )}

      {sante && (
        <>
          <h3 className="text-sm font-semibold mt-3 mb-1">{t("gscSante.plan.title")}</h3>
          {sante.planError && (
            <p className="text-sm text-red-700 m-0">{t("gscSante.plan.error", { error: sante.planError })}</p>
          )}
          {plan && (
            <ul className="text-sm m-0 pl-0 list-none space-y-1">
              {plan.declared.map((s) => (
                <li key={s.path}>
                  <span className="font-mono text-xs">{short(s.path)}</span>
                  <span className="text-chanv-terre/60">
                    {" — "}
                    {s.lastDownloaded
                      ? t("gscSante.plan.read", { date: day(s.lastDownloaded) })
                      : t("gscSante.plan.pending")}
                  </span>
                  {s.errors > 0 && (
                    <span className="text-red-700 font-semibold">
                      {" · "}
                      {t("gscSante.plan.errors", { n: s.errors })}
                    </span>
                  )}
                </li>
              ))}
              {plan.declared.length === 0 && <li className="text-red-700">{t("gscSante.plan.none")}</li>}
              {plan.submitted.length > 0 && (
                <li className="text-chanv-terre/80">
                  {t("gscSante.plan.submitted", { paths: plan.submitted.map(short).join(", ") })}
                </li>
              )}
              {plan.removed.length > 0 && (
                <li className="text-chanv-terre/80">
                  {t("gscSante.plan.removed", { paths: plan.removed.map(short).join(", ") })}
                </li>
              )}
              {plan.problems.map((p) => (
                <li key={p} className="text-amber-800">
                  {p}
                </li>
              ))}
            </ul>
          )}

          <h3 className="text-sm font-semibold mt-5 mb-1">{t("gscSante.pages.title")}</h3>
          {pages?.error && (
            <p className="text-sm text-red-700 m-0">{t("gscSante.pages.error", { error: pages.error })}</p>
          )}
          {pages && !pages.error && (
            <>
              <p className="text-xs text-chanv-terre/60 m-0">
                {t("gscSante.pages.help", { start: day(pages.window.start), end: day(pages.window.end) })}
              </p>
              <p className="text-xs text-chanv-terre/60 mt-1 mb-0">
                {t("gscSante.pages.summary", {
                  shown: nf.format(pages.shown),
                  checked: nf.format(pages.checked),
                  ok: nf.format(pages.ok),
                })}
                {unchecked > 0 && ` · ${t("gscSante.pages.partial", { n: nf.format(unchecked) })}`}
              </p>
              {groups.length === 0 && <p className="text-sm mt-3 m-0">{t("gscSante.pages.none")}</p>}
              {groups.map((g) => {
                const open = expanded[g.kind] === true;
                const rows = open ? g.rows : g.rows.slice(0, ROWS_PER_KIND);
                return (
                  <div key={g.kind} className="mt-4">
                    <p className="text-sm font-semibold m-0">
                      {t(`gscSante.kind.${g.kind}`)} ({nf.format(g.rows.length)})
                    </p>
                    <p className="text-xs text-chanv-terre/70 mt-1 mb-2">{t(`gscSante.todo.${g.kind}`)}</p>
                    <div className="table-scroll">
                      <table className="table-wide text-sm">
                        <thead>
                          <tr className="text-left border-b border-chanv-fibre">
                            <th className="py-2 pr-3">{t("gscSante.col.page")}</th>
                            <th className="py-2 px-3">{t("gscSante.col.answer")}</th>
                            <th className="py-2 px-3 text-right whitespace-nowrap">{t("gscSante.col.impressions")}</th>
                            <th className="py-2 px-3 text-right whitespace-nowrap">{t("gscSante.col.clicks")}</th>
                            <th className="py-2 px-3 whitespace-nowrap">{t("gscSante.col.lastSeen")}</th>
                            <th className="py-2 pl-3" />
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((s) => (
                            <tr key={s.url} className="border-b border-chanv-fibre/60 last:border-0">
                              <td className="py-2 pr-3 font-mono text-xs break-all" title={s.url}>
                                {short(s.url)}
                              </td>
                              <td className="py-2 px-3 text-xs">{answerCell(s)}</td>
                              <td className="py-2 px-3 text-right tabular-nums">{nf.format(s.impressions)}</td>
                              <td className="py-2 px-3 text-right tabular-nums">{nf.format(s.clicks)}</td>
                              <td className="py-2 px-3 whitespace-nowrap">{s.lastSeen ? day(s.lastSeen) : "—"}</td>
                              <td className="py-2 pl-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => copy(s.url)}
                                  className="btn btn-secondary text-xs"
                                  title={t("gscSante.copyHint")}
                                >
                                  {copied === s.url ? t("gscSante.copied") : t("gscSante.copy")}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {g.rows.length > ROWS_PER_KIND && (
                      <button
                        type="button"
                        className="text-xs underline mt-2"
                        onClick={() => setExpanded((e) => ({ ...e, [g.kind]: !open }))}
                      >
                        {open
                          ? t("gscSante.showLess")
                          : t("gscSante.showAll", { n: nf.format(g.rows.length) })}
                      </button>
                    )}
                  </div>
                );
              })}
              <div className="flex flex-wrap items-center gap-3 mt-4">
                <a
                  href={searchConsoleUrl(sante.siteUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary"
                >
                  {t("gscSante.openGsc")}
                </a>
                <a
                  href={searchConsoleUrl(sante.siteUrl, "removals")}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary"
                >
                  {t("gscSante.openRemovals")}
                </a>
                <span className="text-xs text-chanv-terre/60">{t("gscSante.gscHint")}</span>
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
