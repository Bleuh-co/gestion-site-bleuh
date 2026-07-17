"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";
import type { Role } from "@/lib/types";
import type {
  SeoReport,
  SeoPageResult,
  SeoSeverity,
  SeoAnalyseResult,
} from "@/lib/seo-types";

interface SeoClientProps {
  role: Role;
}

/** Signature de la fonction de traduction `t` renvoyée par useT(). */
type TFn = (key: string, vars?: Record<string, string | number>) => string;

const nombreFmt = new Intl.NumberFormat("fr-CA");
const dateFmt = new Intl.DateTimeFormat("fr-CA", {
  dateStyle: "long",
  timeStyle: "short",
});

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : dateFmt.format(d);
}

// ── Petites primitives d'affichage ───────────────────────────────

function Pastille({ ok }: { ok: boolean }) {
  return (
    <span
      aria-hidden
      className="inline-block h-2.5 w-2.5 rounded-full flex-shrink-0"
      style={{ background: ok ? "#2f9e44" : "var(--color-danger)" }}
    />
  );
}

function scoreColor(score: number): string {
  if (score >= 80) return "#2f9e44";
  if (score >= 50) return "#d9a000";
  return "var(--color-danger)";
}

const SEVERITY_META: Record<SeoSeverity, { labelKey: string; color: string }> = {
  critique: { labelKey: "seo.severityCritique", color: "var(--color-danger)" },
  moyenne: { labelKey: "seo.severityMoyenne", color: "#d9a000" },
  info: { labelKey: "seo.severityInfo", color: "#4a5568" },
};

function TechCard({
  ok,
  title,
  detail,
}: {
  ok: boolean;
  title: string;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-chanv-fibre p-3 flex items-start gap-2.5">
      <span className="mt-1.5">
        <Pastille ok={ok} />
      </span>
      <div className="min-w-0">
        <p className="font-semibold text-sm">{title}</p>
        <p className="text-xs text-chanv-terre/60 break-words">{detail}</p>
      </div>
    </div>
  );
}

// Statut d'un champ de page : ok / avertissement / manquant.
type FieldState = "ok" | "warn" | "missing";
function FieldBadge({ state, text }: { state: FieldState; text: string }) {
  const color =
    state === "ok" ? "#2f9e44" : state === "warn" ? "#d9a000" : "var(--color-danger)";
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span
        aria-hidden
        className="inline-block h-2 w-2 rounded-full"
        style={{ background: color }}
      />
      <span className="text-xs">{text}</span>
    </span>
  );
}

// ── Dérivations par page ────────────────────────────────────────

function titleState(p: SeoPageResult, t: TFn): { state: FieldState; text: string } {
  if (!p.title.present) return { state: "missing", text: t("seo.fieldMissing") };
  if (p.title.length > 60)
    return { state: "warn", text: t("seo.fieldLong", { n: p.title.length }) };
  return { state: "ok", text: t("seo.fieldOk", { n: p.title.length }) };
}

function metaState(p: SeoPageResult, t: TFn): { state: FieldState; text: string } {
  if (!p.metaDescription.present) return { state: "missing", text: t("seo.fieldMissing") };
  if (p.metaDescription.length > 160)
    return { state: "warn", text: t("seo.fieldLong", { n: p.metaDescription.length }) };
  return { state: "ok", text: t("seo.fieldOk", { n: p.metaDescription.length }) };
}

function h1State(p: SeoPageResult): { state: FieldState; text: string } {
  if (p.h1Count === 0) return { state: "missing", text: "0" };
  if (p.h1Count > 1) return { state: "warn", text: String(p.h1Count) };
  return { state: "ok", text: "1" };
}

// Petit compteur de problèmes propres à la page, pour la colonne « Issues ».
function pageIssueCount(p: SeoPageResult): number {
  let n = 0;
  if (p.error) n++;
  if (!p.title.present || p.title.length > 60) n++;
  if (!p.metaDescription.present) n++;
  if (p.h1Count !== 1) n++;
  if (!p.canonical.present) n++;
  if (p.metaRobots.noindex) n++;
  if (p.jsonLd.blocks === 0) n++;
  if (p.images.missingAlt > 0) n++;
  if (p.thinContent) n++;
  return n;
}

function shortUrl(url: string, base: string): string {
  if (url.startsWith(base)) {
    const rest = url.slice(base.length);
    return rest === "" ? "/" : rest;
  }
  try {
    return new URL(url).pathname || url;
  } catch {
    return url;
  }
}

// ─────────────────────────────────────────────────────────────────

export function SeoClient({ role }: SeoClientProps) {
  const t = useT();
  const canWrite = role === "gestionnaire" || role === "admin" || role === "superadmin";

  const [report, setReport] = useState<SeoReport | null>(null);
  const [empty, setEmpty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [scanLoading, setScanLoading] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  const [ai, setAi] = useState<SeoAnalyseResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch("/api/seo/report", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || t("seo.errorGeneric", { n: res.status }));
        }
        return res.json();
      })
      .then((json: SeoReport | { empty: true }) => {
        if (cancelled) return;
        if ("empty" in json) {
          setEmpty(true);
          setReport(null);
        } else {
          setEmpty(false);
          setReport(json);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : t("seo.loadFailed"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleScan() {
    setScanLoading(true);
    setScanError(null);
    try {
      const res = await fetch("/api/seo/scan", { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || t("seo.errorGeneric", { n: res.status }));
      }
      const json: SeoReport = await res.json();
      setReport(json);
      setEmpty(false);
      setAi(null); // l'ancienne synthèse IA portait sur le rapport précédent
      setAiError(null);
    } catch (e) {
      setScanError(e instanceof Error ? e.message : t("seo.scanFailed"));
    } finally {
      setScanLoading(false);
    }
  }

  async function handleAnalyse() {
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch("/api/seo/analyse", { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || t("seo.errorGeneric", { n: res.status }));
      }
      const json: SeoAnalyseResult = await res.json();
      setAi(json);
    } catch (e) {
      setAiError(e instanceof Error ? e.message : t("seo.aiFailed"));
    } finally {
      setAiLoading(false);
    }
  }

  const tech = report?.technical;
  const sum = report?.summary;

  // Vérifications techniques agrégées (site-wide + dérivées des pages).
  const ogMissing = report
    ? report.pages.filter((p) => !p.error && (!p.openGraph.title || !p.openGraph.image)).length
    : 0;

  return (
    <main className="mx-auto max-w-6xl p-6">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t("seo.title")}</h1>
          <p className="text-sm text-chanv-terre/70">{t("seo.subtitle")}</p>
        </div>
        {canWrite && (
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              className="btn-primary"
              onClick={handleScan}
              disabled={scanLoading}
            >
              {scanLoading ? t("seo.scanning") : t("seo.runScan")}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleAnalyse}
              disabled={aiLoading || !report}
              title={!report ? t("seo.runScanFirstTooltip") : undefined}
            >
              {aiLoading ? t("seo.aiRunning") : t("seo.aiRecommendations")}
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="card p-4 mb-6 border-l-4" style={{ borderLeftColor: "var(--color-danger)" }}>
          <p className="text-sm">{error}</p>
        </div>
      )}
      {scanError && (
        <div className="card p-4 mb-6 border-l-4" style={{ borderLeftColor: "var(--color-danger)" }}>
          <p className="text-sm">{scanError}</p>
        </div>
      )}

      {loading && <p className="text-sm text-chanv-terre/70">{t("seo.loadingReport")}</p>}

      {/* État vide : aucun scan n'a encore tourné. */}
      {!loading && empty && !report && (
        <div className="section-card text-center">
          <p className="text-lg font-semibold mb-2">{t("seo.emptyTitle")}</p>
          <p className="text-sm text-chanv-terre/70 mb-4">
            {canWrite ? t("seo.emptyBodyCanWrite") : t("seo.emptyBodyReadOnly")}
          </p>
          {canWrite && (
            <button type="button" className="btn-primary" onClick={handleScan} disabled={scanLoading}>
              {scanLoading ? t("seo.scanning") : t("seo.runFirstScan")}
            </button>
          )}
        </div>
      )}

      {!loading && report && tech && sum && (
        <>
          {/* Score + résumé */}
          <div className="grid gap-4 sm:grid-cols-3 mb-6">
            <div className="card p-5 flex flex-col items-center justify-center">
              <p className="label mb-1">{t("seo.globalScore")}</p>
              <p className="text-5xl font-bold" style={{ color: scoreColor(report.score) }}>
                {report.score}
                <span className="text-2xl text-chanv-terre/40">/100</span>
              </p>
            </div>
            <div className="card p-5 sm:col-span-2 flex flex-col justify-center gap-1">
              <p className="text-sm">
                <span className="font-semibold">{nombreFmt.format(report.pagesScanned)}</span>{" "}
                {t("seo.pagesAnalysed")} ·{" "}
                <span className="font-semibold">{report.issues.length}</span>{" "}
                {t("seo.issuesDetected")}
              </p>
              <p className="text-xs text-chanv-terre/60">
                {t("seo.siteLabel")} <span className="font-mono">{report.baseUrl}</span>
              </p>
              <p className="text-xs text-chanv-terre/60">
                {t("seo.generatedOn")} {fmtDate(report.generatedAt)}
              </p>
            </div>
          </div>

          {/* Vérifications techniques */}
          <section className="card p-4 mb-6">
            <h2 className="text-lg font-semibold mb-3">{t("seo.technicalChecks")}</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <TechCard
                ok={tech.robotsTxt.present && tech.robotsTxt.status < 400}
                title="robots.txt"
                detail={
                  tech.robotsTxt.present
                    ? `${t("seo.present", { n: tech.robotsTxt.status })}${
                        tech.robotsTxt.hasSitemapRef
                          ? t("seo.sitemapRefYes")
                          : t("seo.sitemapRefNo")
                      }`
                    : t("seo.absentOrUnreachable")
                }
              />
              <TechCard
                ok={tech.sitemapXml.present}
                title="sitemap.xml"
                detail={
                  tech.sitemapXml.present
                    ? t("seo.sitemapUrls", {
                        count: nombreFmt.format(tech.sitemapXml.urlCount),
                        status: tech.sitemapXml.status,
                      })
                    : t("seo.absentOrUnreachable")
                }
              />
              <TechCard
                ok={tech.https}
                title="HTTPS"
                detail={tech.https ? t("seo.servedHttps") : t("seo.notServedHttps")}
              />
              <TechCard
                ok={sum.pagesMissingHreflang === 0}
                title="hreflang"
                detail={
                  sum.pagesMissingHreflang === 0
                    ? t("seo.hreflangAllPresent")
                    : t("seo.hreflangMissing", { n: sum.pagesMissingHreflang })
                }
              />
              <TechCard
                ok={sum.pagesMissingCanonical === 0}
                title="Canonical"
                detail={
                  sum.pagesMissingCanonical === 0
                    ? t("seo.canonicalAllPresent")
                    : t("seo.canonicalMissing", { n: sum.pagesMissingCanonical })
                }
              />
              <TechCard
                ok={sum.pagesMissingJsonLd === 0}
                title="JSON-LD"
                detail={
                  sum.pagesMissingJsonLd === 0
                    ? t("seo.jsonLdAllPresent")
                    : t("seo.jsonLdMissing", { n: sum.pagesMissingJsonLd })
                }
              />
              <TechCard
                ok={ogMissing === 0}
                title="Open Graph"
                detail={
                  ogMissing === 0
                    ? t("seo.ogAllPresent")
                    : t("seo.ogMissing", { n: ogMissing })
                }
              />
            </div>
          </section>

          {/* Synthèse IA (si demandée) */}
          {(ai || aiError || aiLoading) && (
            <section className="card p-4 mb-6">
              <h2 className="text-lg font-semibold mb-2">{t("seo.aiRecommendations")}</h2>
              {aiLoading && <p className="text-sm text-chanv-terre/70">{t("seo.aiGenerating")}</p>}
              {aiError && (
                <div className="border-l-4 pl-3" style={{ borderLeftColor: "var(--color-danger)" }}>
                  <p className="text-sm">{aiError}</p>
                </div>
              )}
              {ai && !aiLoading && (
                <div className="space-y-3">
                  {ai.summary ? (
                    <p className="text-sm whitespace-pre-line leading-relaxed">{ai.summary}</p>
                  ) : (
                    <p className="text-sm text-chanv-terre/70">{t("seo.aiUnavailable")}</p>
                  )}
                  {ai.recommendations.length > 0 && (
                    <ol className="space-y-2">
                      {ai.recommendations.map((r, i) => (
                        <li key={i} className="rounded-lg border border-chanv-fibre p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <span
                              className="badge"
                              style={{
                                background:
                                  r.priorite === "haute"
                                    ? "var(--color-danger)"
                                    : r.priorite === "moyenne"
                                    ? "#d9a000"
                                    : "#4a5568",
                                color: "#fff",
                              }}
                            >
                              {r.priorite}
                            </span>
                            <span className="font-semibold text-sm">{r.action}</span>
                          </div>
                          <p className="text-xs text-chanv-terre/70">{r.pourquoi}</p>
                        </li>
                      ))}
                    </ol>
                  )}
                  {ai.model && (
                    <p className="text-[11px] text-chanv-terre/50">
                      {t("seo.modelLabel")} {ai.model}
                    </p>
                  )}
                </div>
              )}
            </section>
          )}

          {/* Issues classées par sévérité */}
          <section className="card p-4 mb-6">
            <h2 className="text-lg font-semibold mb-3">{t("seo.issuesTitle")}</h2>
            {report.issues.length === 0 ? (
              <p className="text-sm text-chanv-terre/70">{t("seo.noIssues")}</p>
            ) : (
              <ul className="space-y-2">
                {report.issues.map((issue) => {
                  const meta = SEVERITY_META[issue.severity];
                  return (
                    <li
                      key={issue.id}
                      className="rounded-lg border border-chanv-fibre p-3 border-l-4"
                      style={{ borderLeftColor: meta.color }}
                    >
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="badge" style={{ background: meta.color, color: "#fff" }}>
                          {t(meta.labelKey)}
                        </span>
                        <span className="font-semibold text-sm">{issue.title}</span>
                        {issue.pagesAffected > 0 && (
                          <span className="text-xs text-chanv-terre/60">
                            {t("seo.pagesCount", { n: nombreFmt.format(issue.pagesAffected) })}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-chanv-terre/70">{issue.detail}</p>
                      {issue.sampleUrls && issue.sampleUrls.length > 0 && (
                        <p className="text-[11px] text-chanv-terre/50 mt-1 break-all">
                          {issue.sampleUrls.map((u) => shortUrl(u, report.baseUrl)).join(" · ")}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Tableau par page */}
          <section className="card p-4">
            <h2 className="text-lg font-semibold mb-3">{t("seo.perPageTitle")}</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-chanv-fibre text-xs uppercase tracking-wide text-chanv-terre/60">
                    <th className="py-2 pr-3 font-semibold">{t("seo.colUrl")}</th>
                    <th className="py-2 px-3 font-semibold">{t("seo.colTitle")}</th>
                    <th className="py-2 px-3 font-semibold">{t("seo.colMetaDesc")}</th>
                    <th className="py-2 px-3 font-semibold">{t("seo.colH1")}</th>
                    <th className="py-2 px-3 font-semibold">{t("seo.colJsonLd")}</th>
                    <th className="py-2 pl-3 font-semibold">{t("seo.colIssues")}</th>
                  </tr>
                </thead>
                <tbody>
                  {report.pages.map((p) => {
                    const titleSt = titleState(p, t);
                    const metaSt = metaState(p, t);
                    const h1St = h1State(p);
                    const issues = pageIssueCount(p);
                    return (
                      <tr key={p.url} className="border-b border-chanv-fibre/60 align-top">
                        <td className="py-2 pr-3">
                          <span className="font-mono text-xs break-all">
                            {shortUrl(p.url, report.baseUrl)}
                          </span>
                          {p.error ? (
                            <span
                              className="block text-[11px]"
                              style={{ color: "var(--color-danger)" }}
                            >
                              {t("seo.errorLabel")} {p.error}
                            </span>
                          ) : (
                            <span className="block text-[11px] text-chanv-terre/50">
                              HTTP {p.status}
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          <FieldBadge state={titleSt.state} text={titleSt.text} />
                        </td>
                        <td className="py-2 px-3">
                          <FieldBadge state={metaSt.state} text={metaSt.text} />
                        </td>
                        <td className="py-2 px-3">
                          <FieldBadge state={h1St.state} text={h1St.text} />
                        </td>
                        <td className="py-2 px-3">
                          <FieldBadge
                            state={p.jsonLd.blocks > 0 ? "ok" : "missing"}
                            text={
                              p.jsonLd.blocks > 0
                                ? p.jsonLd.types.length > 0
                                  ? p.jsonLd.types.join(", ")
                                  : t("seo.blocksCount", { n: p.jsonLd.blocks })
                                : t("seo.jsonLdNone")
                            }
                          />
                        </td>
                        <td className="py-2 pl-3">
                          <span
                            className="badge"
                            style={{
                              background: issues === 0 ? "#2f9e44" : "var(--color-danger)",
                              color: "#fff",
                            }}
                          >
                            {issues}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
