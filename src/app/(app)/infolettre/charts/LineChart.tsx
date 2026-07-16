"use client";

import { useState } from "react";

export interface LineSeries {
  label: string;
  color: string;
  /** Valeurs y alignées sur `labels` (même longueur). null = trou (non tracé). */
  values: (number | null)[];
}

interface LineChartProps {
  /** Étiquettes de l'axe X (une par point). */
  labels: string[];
  series: LineSeries[];
  /** Formatte une valeur y pour le tooltip / l'axe. */
  formatValue?: (v: number) => string;
  height?: number;
  /** Suffixe d'axe Y optionnel (ex. "%"). */
  yUnit?: string;
}

const PAD = { top: 12, right: 14, bottom: 26, left: 44 };
const VB_W = 720;

/**
 * Graphique linéaire multi-séries, SVG inline, dépendance zéro.
 * viewBox fixe + width:100% → responsive. Survol d'un point → tooltip.
 */
export function LineChart({
  labels,
  series,
  formatValue = (v) => v.toLocaleString("fr-CA"),
  height = 240,
  yUnit,
}: LineChartProps) {
  const [hover, setHover] = useState<{ s: number; i: number } | null>(null);

  const allVals = series.flatMap((s) =>
    s.values.filter((v): v is number => v != null)
  );
  const n = labels.length;
  const plotW = VB_W - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;

  if (allVals.length === 0 || n === 0) {
    return (
      <div className="text-sm text-chanv-terre/40 py-8 text-center">
        Aucune donnée à afficher.
      </div>
    );
  }

  let min = Math.min(...allVals);
  let max = Math.max(...allVals);
  if (min === max) {
    // Série plate : ouvre un peu la fenêtre pour éviter division par 0.
    min = min === 0 ? 0 : min * 0.95;
    max = max === 0 ? 1 : max * 1.05;
  } else {
    min = min - (max - min) * 0.08;
  }
  const span = max - min || 1;

  const x = (i: number) => PAD.left + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (v: number) => PAD.top + plotH - ((v - min) / span) * plotH;

  // 4 lignes de grille horizontales.
  const ticks = 4;
  const gridY = Array.from({ length: ticks + 1 }, (_, k) => {
    const v = min + (span * k) / ticks;
    return { v, py: y(v) };
  });

  // Étiquettes X clairsemées (max ~6).
  const step = Math.max(1, Math.ceil(n / 6));

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${VB_W} ${height}`}
        width="100%"
        role="img"
        style={{ display: "block", overflow: "visible" }}
      >
        {/* Grille + graduations Y */}
        {gridY.map((g, k) => (
          <g key={k}>
            <line
              x1={PAD.left}
              x2={VB_W - PAD.right}
              y1={g.py}
              y2={g.py}
              stroke="#28282814"
              strokeWidth={1}
            />
            <text
              x={PAD.left - 6}
              y={g.py + 3}
              textAnchor="end"
              fontSize={10}
              fill="#28282866"
            >
              {formatValue(g.v)}
              {yUnit ?? ""}
            </text>
          </g>
        ))}

        {/* Étiquettes X */}
        {labels.map((lab, i) =>
          i % step === 0 || i === n - 1 ? (
            <text
              key={i}
              x={x(i)}
              y={height - 8}
              textAnchor="middle"
              fontSize={10}
              fill="#28282866"
            >
              {lab}
            </text>
          ) : null
        )}

        {/* Séries */}
        {series.map((s, si) => {
          const pts = s.values
            .map((v, i) => (v == null ? null : `${x(i)},${y(v)}`))
            .filter((p): p is string => p != null);
          return (
            <g key={si}>
              {pts.length > 1 && (
                <polyline
                  points={pts.join(" ")}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              )}
              {s.values.map((v, i) =>
                v == null ? null : (
                  <circle
                    key={i}
                    cx={x(i)}
                    cy={y(v)}
                    r={hover && hover.s === si && hover.i === i ? 4.5 : 2.5}
                    fill={s.color}
                    onMouseEnter={() => setHover({ s: si, i })}
                    onMouseLeave={() => setHover(null)}
                    style={{ cursor: "pointer" }}
                  />
                )
              )}
            </g>
          );
        })}

        {/* Tooltip */}
        {hover &&
          (() => {
            const v = series[hover.s].values[hover.i];
            if (v == null) return null;
            const px = x(hover.i);
            const py = y(v);
            const text = `${labels[hover.i]} · ${formatValue(v)}${yUnit ?? ""}`;
            const w = Math.max(70, text.length * 6.2);
            const left = Math.min(Math.max(px - w / 2, 2), VB_W - w - 2);
            const top = py - 30 < 4 ? py + 10 : py - 30;
            return (
              <g pointerEvents="none">
                <rect
                  x={left}
                  y={top}
                  width={w}
                  height={22}
                  rx={5}
                  fill="#282828"
                />
                <text
                  x={left + w / 2}
                  y={top + 15}
                  textAnchor="middle"
                  fontSize={11}
                  fill="#fff"
                >
                  {text}
                </text>
              </g>
            );
          })()}
      </svg>

      {/* Légende */}
      {series.length > 1 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 justify-center">
          {series.map((s, si) => (
            <span key={si} className="inline-flex items-center gap-1.5 text-xs text-chanv-terre/70">
              <span
                className="inline-block w-3 h-0.5 rounded"
                style={{ backgroundColor: s.color }}
              />
              {s.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
