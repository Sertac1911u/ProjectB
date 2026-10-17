"use client";

import { type CurrencyCode, formatMoney } from "@projectb/core";
import { useLocale } from "next-intl";
import { useState } from "react";
import {
  bucketLabel,
  bucketTitle,
  columnPath,
  compactMoney,
  niceTicks,
} from "./scale";
import { useWidth } from "./use-width";

type Row = { start: string; income: number; expense: number };

const HEIGHT = 240;
const MARGIN = { top: 12, right: 8, bottom: 28, left: 60 };

/** Income and expense columns per day or month, with a hover readout. */
export function CashFlowChart({
  rows,
  granularity,
  currency,
  labels,
  height = HEIGHT,
}: {
  rows: Row[];
  granularity: "day" | "month";
  currency: CurrencyCode;
  labels: { income: string; expense: string; net: string; chart: string };
  height?: number;
}) {
  const locale = useLocale();
  const [ref, measured] = useWidth<HTMLDivElement>();
  const width = measured ?? 0;
  const [active, setActive] = useState<number | null>(null);

  const innerW = width - MARGIN.left - MARGIN.right;
  const innerH = height - MARGIN.top - MARGIN.bottom;
  const max = Math.max(0, ...rows.flatMap((r) => [r.income, r.expense]));
  const ticks = niceTicks(0, max);
  const top = ticks[ticks.length - 1]!;
  const y = (v: number) => MARGIN.top + innerH - (v / top) * innerH;
  const band = innerW / Math.max(1, rows.length);
  const barW = Math.max(2, Math.min(24, (band * 0.72 - 2) / 2));
  const groupW = barW * 2 + 2;
  const crossesYears =
    granularity === "month" &&
    rows.length > 0 &&
    rows[0]!.start.slice(0, 4) !== rows[rows.length - 1]!.start.slice(0, 4);
  const every = Math.max(1, Math.ceil(rows.length / Math.floor(innerW / 44)));
  const money = (v: number) => formatMoney(v, currency, locale);
  const row = active === null ? null : rows[active];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <LegendItem color="var(--chart-income)" label={labels.income} />
        <LegendItem color="var(--chart-expense)" label={labels.expense} />
      </div>
      <div ref={ref} className="relative min-w-0" style={{ height: height }}>
        {measured !== null && (
          <svg
            width={width}
            height={height}
            role="img"
            aria-label={labels.chart}
            className="block overflow-visible"
            onPointerLeave={() => setActive(null)}
          >
            {ticks.map((tick) => (
              <g key={tick}>
                <line
                  x1={MARGIN.left}
                  x2={width - MARGIN.right}
                  y1={y(tick)}
                  y2={y(tick)}
                  stroke={
                    tick === 0 ? "var(--chart-axis)" : "var(--chart-grid)"
                  }
                  strokeWidth={1}
                  shapeRendering="crispEdges"
                />
                <text
                  x={MARGIN.left - 8}
                  y={y(tick)}
                  dy="0.32em"
                  textAnchor="end"
                  className="fill-muted-foreground text-[11px] tabular-nums"
                >
                  {compactMoney(tick, currency, locale)}
                </text>
              </g>
            ))}
            {rows.map((r, i) => {
              const x0 = MARGIN.left + band * i + (band - groupW) / 2;
              const dim = active !== null && active !== i;
              return (
                <g key={r.start} opacity={dim ? 0.45 : 1}>
                  <path
                    d={columnPath(x0, y(r.income), barW, y(0) - y(r.income))}
                    fill="var(--chart-income)"
                  />
                  <path
                    d={columnPath(
                      x0 + barW + 2,
                      y(r.expense),
                      barW,
                      y(0) - y(r.expense),
                    )}
                    fill="var(--chart-expense)"
                  />
                  {i % every === 0 && (
                    <text
                      x={MARGIN.left + band * i + band / 2}
                      y={height - 8}
                      textAnchor="middle"
                      className="fill-muted-foreground text-[11px]"
                    >
                      {bucketLabel(r.start, granularity, locale, crossesYears)}
                    </text>
                  )}
                </g>
              );
            })}
            {rows.map((r, i) => (
              <rect
                key={r.start}
                x={MARGIN.left + band * i}
                y={MARGIN.top}
                width={band}
                height={innerH}
                fill="transparent"
                tabIndex={0}
                aria-label={`${bucketTitle(r.start, granularity, locale)}: ${labels.income} ${money(r.income)}, ${labels.expense} ${money(r.expense)}`}
                onPointerEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                className="outline-none"
              />
            ))}
          </svg>
        )}
        {row && active !== null && (
          <div
            className="pointer-events-none absolute top-0 z-10 w-max min-w-40 rounded-lg border bg-card px-3 py-2 text-xs shadow-md"
            style={{
              left: Math.min(
                Math.max(0, MARGIN.left + band * active + band / 2 - 80),
                width - 170,
              ),
            }}
          >
            <p className="mb-1 font-medium">
              {bucketTitle(row.start, granularity, locale)}
            </p>
            <TooltipRow
              color="var(--chart-income)"
              label={labels.income}
              value={money(row.income)}
            />
            <TooltipRow
              color="var(--chart-expense)"
              label={labels.expense}
              value={money(row.expense)}
            />
            <TooltipRow
              label={labels.net}
              value={money(row.income - row.expense)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="size-2.5 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
}

function TooltipRow({
  color,
  label,
  value,
}: {
  color?: string;
  label: string;
  value: string;
}) {
  return (
    <p className="flex items-center gap-2 py-0.5">
      <span
        className="h-0.5 w-3 rounded-full"
        style={{ background: color ?? "transparent" }}
      />
      <span className="font-semibold tabular-nums">{value}</span>
      <span className="text-muted-foreground">{label}</span>
    </p>
  );
}
