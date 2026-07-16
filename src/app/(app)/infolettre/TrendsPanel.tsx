"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LineChart, type LineSeries } from "./charts/LineChart";
import { BarChart, type BarDatum } from "./charts/BarChart";

interface MetricsSeriesPoint {
  capturedAt: string;
  total: number;
  active: number;
  unsubscribed: number;
}
interface GroupBreakdown {
  groupId: string;
  name: string;
  active: number;
  total: number;
  growth: number | null;
}
interface MonthlyAggregate {
  month: string;
  campaigns: number;
  recipients: number;
  avgOpenRate: number;
  avgClickRate: number;
}
interface TrendsResponse {
  metricsSeries: MetricsSeriesPoint[];
  byGroup: GroupBreakdown[];
  campaignPoints: unknown[];
  monthly: MonthlyAggregate[];
}

interface Diagnostic {
  campaign: string;
  subject: string;
  opened: number;
  why: string | null;
  recommandations: string[];
}
interface AnalyseResponse {
  summary: string | null;
  insights: string[];
  diagnostics: Diagnostic[];
  meta: {
    generatedAt: string;
    model: string;
    weightedMeanOpenRate: number;
    campaignsAnalyzed: number;
    aiAvailable: boolean;
  };
}

type AlertSeverity = "info" | "warning" | "critical";
interface AlertItem {
  id: string;
  type: string;
  severity: AlertSeverity;
  title: string;
  detail: string;
  metric?: Record<string, number | string>;
}
interface AlertsResponse {
  alerts: AlertItem[];
  generatedAt: string;
  hasData: boolean;
}

// Pastilles de sévérité (couleurs sobres, cohérentes avec la charte).
const SEVERITY_STYLE: Record<
  AlertSeverity,
  { dot: string; card: string; label: string }
> = {
  critical: {
    dot: "bg-rose-500",
    card: "border-rose-200 bg-rose-50",
    label: "Critique",
  },
  warning: {
    dot: "bg-amber-500",
    card: "border-amber-200 bg-amber-50",
    label: "Attention",
  },
  info: {
    dot: "bg-sky-500",
    card: "border-sky-200 bg-sky-50",
    label: "Info",
  },
};

const COLOR = {
  total: "#282828",
  active: "#8A7648",
  unsub: "#C08457",
  open: "#8A7648",
  click: "#4F7A6B",
};

const MONTHS_FR = [
  "janv.", "févr.", "mars", "avr.", "mai", "juin",
  "juill.", "août", "sept.", "oct.", "nov.", "déc.",
];

function fmtInt(n: number): string {
  return Math.round(n).toLocaleString("fr-CA");
}
function fmtPct(n: number): string {
  return `${n.toLocaleString("fr-CA", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
}
function fmtMonth(ym: string): string {
  const [y, m] = ym.split("-");
  const idx = Number(m) - 1;
  return `${MONTHS_FR[idx] ?? m} ${y.slice(2)}`;
}
function fmtDay(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-CA", { day: "numeric", month: "short" });
}
function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString("fr-CA", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-3">
      <h3 className="font-bold">{title}</h3>
      <p className="text-sm text-chanv-terre/55">{subtitle}</p>
    </div>
  );
}

// Bandeau « Alertes » — en tête de l'onglet Tendances.
function AlertsBanner() {
  const [alerts, setAlerts] = useState<AlertsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/infolettre/alerts", { cache: "no-store" });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `Erreur ${res.status}`);
        }
        if (alive) setAlerts((await res.json()) as AlertsResponse);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "Alertes indisponibles.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border border-black/10 bg-white/40 px-4 py-3 text-sm text-chanv-terre/50">
        Vérification des alertes…
      </div>
    );
  }
  // Erreur silencieuse : on ne bloque pas les tendances pour un bandeau annexe.
  if (error || !alerts) return null;

  const { alerts: list, hasData } = alerts;

  return (
    <div className="section-card">
      <SectionTitle
        title="Alertes"
        subtitle="Ce qui mérite votre attention en priorité, calculé à partir des données réelles."
      />
      {list.length > 0 ? (
        <div className="space-y-2">
          {list.map((a) => {
            const s = SEVERITY_STYLE[a.severity];
            return (
              <div
                key={a.id}
                className={`flex items-start gap-3 rounded-xl border ${s.card} px-4 py-3`}
              >
                <span
                  className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${s.dot}`}
                  aria-hidden
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-chanv-terre/90">
                    <span className="sr-only">{s.label} : </span>
                    {a.title}
                  </p>
                  <p className="text-sm text-chanv-terre/70">{a.detail}</p>
                </div>
              </div>
            );
          })}
        </div>
      ) : !hasData ? (
        <p className="text-sm text-chanv-terre/50">
          Pas encore assez de données pour émettre des alertes — elles
          apparaîtront dès les premières captures.
        </p>
      ) : (
        <p className="text-sm text-chanv-terre/50">
          Aucune alerte — tout est dans les normes.
        </p>
      )}
    </div>
  );
}

export function TrendsPanel({ canWrite = false }: { canWrite?: boolean }) {
  const [data, setData] = useState<TrendsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Analyse IA (à la demande — coûte des tokens) ───────
  const [ai, setAi] = useState<AnalyseResponse | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const runAnalysis = useCallback(async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch("/api/infolettre/analyse", {
        method: "POST",
        cache: "no-store",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Erreur ${res.status}`);
      }
      setAi((await res.json()) as AnalyseResponse);
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "Analyse impossible.");
    } finally {
      setAiLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/infolettre/trends", { cache: "no-store" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Erreur ${res.status}`);
      }
      setData((await res.json()) as TrendsResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible de charger les tendances.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ── Croissance des abonnés ─────────────────────────────
  const growth = useMemo(() => {
    const s = data?.metricsSeries ?? [];
    const labels = s.map((p) => fmtDay(p.capturedAt));
    const series: LineSeries[] = [
      { label: "Total", color: COLOR.total, values: s.map((p) => p.total) },
      { label: "Actifs", color: COLOR.active, values: s.map((p) => p.active) },
      { label: "Désabonnés", color: COLOR.unsub, values: s.map((p) => p.unsubscribed) },
    ];
    return { labels, series, count: s.length, first: s[0]?.capturedAt };
  }, [data]);

  // ── Ouverture / clic par mois ──────────────────────────
  const rates = useMemo(() => {
    const m = data?.monthly ?? [];
    const labels = m.map((x) => fmtMonth(x.month));
    const series: LineSeries[] = [
      { label: "Taux d'ouverture", color: COLOR.open, values: m.map((x) => x.avgOpenRate) },
      { label: "Taux de clic", color: COLOR.click, values: m.map((x) => x.avgClickRate) },
    ];
    return { labels, series, count: m.length };
  }, [data]);

  // ── Volume d'envoi par mois ────────────────────────────
  const volume: BarDatum[] = useMemo(
    () =>
      (data?.monthly ?? []).map((x) => ({
        label: fmtMonth(x.month),
        value: x.recipients,
      })),
    [data]
  );

  // ── Ventilation par groupe (dernier snapshot) ──────────
  const groups: BarDatum[] = useMemo(
    () => (data?.byGroup ?? []).map((g) => ({ label: g.name, value: g.active })),
    [data]
  );

  if (loading && !data)
    return <div className="card p-8 text-center text-gray-400">Chargement des tendances…</div>;
  if (error)
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
        {error}
      </div>
    );
  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Bandeau Alertes — en tête, autonome (fetch propre). */}
      <AlertsBanner />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm text-chanv-terre/60 max-w-xl">
          Les chiffres qui parlent : santé de la liste dans le temps et performance des campagnes
          par mois. Survolez un point ou une barre pour le détail.
        </p>
        <button className="btn-secondary" disabled={loading} onClick={load}>
          {loading ? "Actualisation…" : "Actualiser"}
        </button>
      </div>

      {/* Analyse IA — Gestionnaire+ (la garde serveur requireWrite reste la vraie barrière) */}
      {canWrite && (
        <div className="section-card">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <SectionTitle
              title="Analyse IA"
              subtitle="Diagnostic des tendances et des campagnes qui ont sous-performé, d'après leur contenu."
            />
            <button className="btn-primary" disabled={aiLoading} onClick={runAnalysis}>
              {aiLoading ? "Analyse en cours…" : "Analyser avec l'IA"}
            </button>
          </div>

          {aiError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {aiError}
            </div>
          )}

          {aiLoading && !ai && (
            <div className="rounded-xl bg-chanv-fibre/60 px-4 py-6 text-sm text-chanv-terre/70">
              L&apos;IA lit les tendances et le contenu des campagnes sous-performantes. Quelques
              secondes…
            </div>
          )}

          {ai && !aiLoading && (
            <div className="space-y-5 mt-1">
              {ai.summary ? (
                <p className="text-sm text-chanv-terre/80 leading-relaxed">{ai.summary}</p>
              ) : (
                <p className="text-sm text-chanv-terre/50">
                  Synthèse IA indisponible (clé Anthropic absente). Les campagnes ci-dessous sont
                  celles repérées sous la moyenne pondérée d&apos;ouverture (
                  {fmtPct(ai.meta.weightedMeanOpenRate)}).
                </p>
              )}

              {ai.insights.length > 0 && (
                <ul className="space-y-1.5">
                  {ai.insights.map((it, i) => (
                    <li key={i} className="text-sm text-chanv-terre/80 flex gap-2">
                      <span className="text-chanv-mousse">•</span>
                      <span>{it}</span>
                    </li>
                  ))}
                </ul>
              )}

              {ai.diagnostics.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-bold text-chanv-terre/80">
                    Campagnes sous-performantes ({ai.diagnostics.length})
                  </h4>
                  {ai.diagnostics.map((d, i) => (
                    <div key={i} className="rounded-xl border border-black/10 bg-white/40 p-4">
                      <div className="flex items-baseline justify-between gap-3 flex-wrap">
                        <p className="font-semibold text-sm">{d.campaign}</p>
                        <span className="text-xs font-medium text-chanv-cuivre">
                          {fmtPct(d.opened)} d&apos;ouverture
                        </span>
                      </div>
                      {d.subject && (
                        <p className="text-xs text-chanv-terre/50 mt-0.5">Objet : {d.subject}</p>
                      )}
                      {d.why && (
                        <p className="text-sm text-chanv-terre/80 mt-2">
                          <span className="font-medium">Pourquoi : </span>
                          {d.why}
                        </p>
                      )}
                      {d.recommandations.length > 0 && (
                        <ul className="mt-2 space-y-1">
                          {d.recommandations.map((r, j) => (
                            <li key={j} className="text-sm text-chanv-terre/75 flex gap-2">
                              <span className="text-chanv-mousse">→</span>
                              <span>{r}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <p className="text-[11px] text-chanv-terre/40">
                Généré le {fmtDateTime(ai.meta.generatedAt)} · {ai.meta.model} · analyse marketing,
                aucune allégation santé.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Croissance des abonnés */}
      <div className="section-card">
        <SectionTitle
          title="Croissance des abonnés"
          subtitle="Total, actifs et désabonnés à chaque capture (toutes les 6 h)."
        />
        {growth.count >= 2 ? (
          <LineChart labels={growth.labels} series={growth.series} formatValue={fmtInt} />
        ) : (
          <div className="rounded-xl bg-chanv-fibre/60 px-4 py-6 text-sm text-chanv-terre/70">
            La courbe se construit —{" "}
            {growth.first
              ? `1re capture le ${fmtDateTime(growth.first)}`
              : "aucune capture encore"}
            , prochaine dans quelques heures. Un seul point ne fait pas une tendance : on préfère
            attendre plutôt qu&apos;afficher une fausse courbe.
          </div>
        )}
      </div>

      {/* Évolution ouverture / clic */}
      <div className="section-card">
        <SectionTitle
          title="Évolution ouverture / clic"
          subtitle="Moyennes mensuelles pondérées par le nombre de destinataires."
        />
        {rates.count >= 2 ? (
          <LineChart
            labels={rates.labels}
            series={rates.series}
            formatValue={(v) => v.toLocaleString("fr-CA", { maximumFractionDigits: 1 })}
            yUnit=" %"
          />
        ) : rates.count === 1 ? (
          <p className="text-sm text-chanv-terre/70">
            Un seul mois de campagnes pour l&apos;instant ({fmtMonth(data.monthly[0].month)} :{" "}
            {fmtPct(data.monthly[0].avgOpenRate)} d&apos;ouverture,{" "}
            {fmtPct(data.monthly[0].avgClickRate)} de clic). La tendance apparaîtra dès le 2e mois.
          </p>
        ) : (
          <p className="text-sm text-chanv-terre/40">Aucune campagne datée.</p>
        )}
      </div>

      {/* Volume d'envoi */}
      <div className="section-card">
        <SectionTitle
          title="Volume d'envoi"
          subtitle="Destinataires touchés par mois (somme de toutes les campagnes)."
        />
        <BarChart data={volume} formatValue={fmtInt} />
      </div>

      {/* Ventilation par groupe */}
      <div className="section-card">
        <SectionTitle
          title="Ventilation par groupe"
          subtitle="Abonnés actifs par liste, à la dernière capture."
        />
        <BarChart data={groups} formatValue={fmtInt} color="#4F7A6B" />
      </div>
    </div>
  );
}
