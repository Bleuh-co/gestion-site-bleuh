"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n";

export interface BarDatum {
  label: string;
  value: number;
}

interface BarChartProps {
  data: BarDatum[];
  color?: string;
  formatValue?: (v: number) => string;
  height?: number;
  yUnit?: string;
}

const PAD = { top: 12, right: 14, bottom: 40, left: 44 };
const VB_W = 720;

/**
 * Diagramme à barres, SVG inline, dépendance zéro.
 * viewBox fixe + width:100% → responsive. Survol d'une barre → tooltip.
 */
export function BarChart({
  data,
  color = "#8A7648",
  formatValue = (v) => v.toLocaleString("fr-CA"),
  height = 260,
  yUnit,
}: BarChartProps) {
  const [hover, setHover] = useState<number | null>(null);
  const t = useT();

  if (data.length === 0) {
    return (
      <div className="text-sm text-chanv-terre/40 py-8 text-center">
        {t("chart.empty")}
      </div>
    );
  }

  const plotW = VB_W - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;
  const max = Math.max(...data.map((d) => d.value), 1);

  const n = data.length;
  const slot = plotW / n;
  const barW = Math.min(slot * 0.62, 60);

  const ticks = 4;
  const gridY = Array.from({ length: ticks + 1 }, (_, k) => {
    const v = (max * k) / ticks;
    return { v, py: PAD.top + plotH - (v / max) * plotH };
  });

  // Étiquettes X clairsemées si beaucoup de catégories.
  const step = Math.max(1, Math.ceil(n / 12));

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${VB_W} ${height}`}
        width="100%"
        role="img"
        style={{ display: "block", overflow: "visible" }}
      >
        {gridY.map((g, k) => (
          <g key={k}>
            <line
              x1={PAD.left}
              x2={VB_W - PAD.right}
              y1={g.py}
              y2={g.py}
              style={{ stroke: "var(--chart-grid)" }}
              strokeWidth={1}
            />
            <text
              x={PAD.left - 6}
              y={g.py + 3}
              textAnchor="end"
              fontSize={10}
              style={{ fill: "var(--chart-axis)" }}
            >
              {formatValue(g.v)}
              {yUnit ?? ""}
            </text>
          </g>
        ))}

        {data.map((d, i) => {
          const bh = (d.value / max) * plotH;
          const bx = PAD.left + i * slot + (slot - barW) / 2;
          const by = PAD.top + plotH - bh;
          const showLabel = i % step === 0 || n <= 12;
          return (
            <g key={i}>
              <rect
                x={bx}
                y={by}
                width={barW}
                height={Math.max(bh, 0)}
                rx={3}
                opacity={hover === null || hover === i ? 1 : 0.55}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                style={{ fill: color, cursor: "pointer" }}
              />
              {showLabel && (
                <text
                  x={bx + barW / 2}
                  y={height - 24}
                  textAnchor="end"
                  fontSize={10}
                  style={{ fill: "var(--chart-axis)" }}
                  transform={`rotate(-40 ${bx + barW / 2} ${height - 24})`}
                >
                  {d.label}
                </text>
              )}
            </g>
          );
        })}

        {hover !== null &&
          (() => {
            const d = data[hover];
            const bx = PAD.left + hover * slot + slot / 2;
            const bh = (d.value / max) * plotH;
            const by = PAD.top + plotH - bh;
            const text = `${d.label} · ${formatValue(d.value)}${yUnit ?? ""}`;
            const w = Math.max(70, text.length * 6.2);
            const left = Math.min(Math.max(bx - w / 2, 2), VB_W - w - 2);
            const top = by - 30 < 4 ? by + 10 : by - 30;
            return (
              <g pointerEvents="none">
                <rect x={left} y={top} width={w} height={22} rx={5} fill="#282828" />
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
    </div>
  );
}
