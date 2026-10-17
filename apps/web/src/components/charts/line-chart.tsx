"use client";

import { type CurrencyCode, formatMoney } from "@projectb/core";
import { useLocale } from "next-intl";
import { type PointerEvent, useState } from "react";
import { bucketLabel, bucketTitle, compactMoney, niceTicks } from "./scale";
import { useWidth } from "./use-width";

type Point = { start: string; at: string; value: number | null };

const HEIGHT = 240;
const MARGIN = { top: 16, right: 16, bottom: 28, left: 64 };

/** One series over time with a crosshair readout, e.g. net worth. */
export function LineChart({
  points,
  granularity,
  currency,
  label,
}: {
  points: Point[];
  granularity: "day" | "month";
  currency: CurrencyCode;
  label: string;
}) {
  const locale = useLocale();
  const [ref, measured] = useWidth<HTMLDivElement>();
  const width = measured ?? 0;
  const [active, setActive] = useState<number | null>(null);

  const values = points.map((p) => p.value);
  const known = values.filter((v): v is number => v !== null);
  const innerW = width - MARGIN.left - MARGIN.right;
  const innerH = HEIGHT - MARGIN.top - MARGIN.bottom;
  if (known.length === 0) return null;
  const ticks = niceTicks(Math.min(...known), Math.max(...known));
  const lo = ticks[0]!;
  const hi = ticks[ticks.length - 1]!;
  // Positions follow the full period, so a partial year leaves room on the right.
  const slots = Math.max(1, points.length - 1);
  const x = (i: number) =>
    MARGIN.left + (points.length === 1 ? innerW / 2 : (i / slots) * innerW);
  const y = (v: number) =>
    MARGIN.top + innerH - ((v - lo) / (hi - lo)) * innerH;

  const segments: { i: number; v: number }[][] = [];
  values.forEach((v, i) => {
    if (v === null) return;
    const last = segments[segments.length - 1];
    if (last && last[last.length - 1]!.i === i - 1) last.push({ i, v });
    else segments.push([{ i, v }]);
  });
  const line = (segment: { i: number; v: number }[]) =>
    segment.map((p, k) => `${k ? "L" : "M"}${x(p.i)},${y(p.v)}`).join("");
  const area = (segment: { i: number; v: number }[]) =>
    `${line(segment)}L${x(segment[segment.length - 1]!.i)},${y(lo)}L${x(segment[0]!.i)},${y(lo)}Z`;
  const lastIndex = values.findLastIndex((v) => v !== null);
  const every = Math.max(1, Math.ceil(points.length / Math.floor(innerW / 44)));
  const crossesYears =
    granularity === "month" &&
    points.length > 0 &&
    points[0]!.start.slice(0, 4) !==
      points[points.length - 1]!.start.slice(0, 4);

  const onMove = (event: PointerEvent<SVGRectElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - box.left) / box.width;
    const i = Math.max(
      0,
      Math.min(Math.round(ratio * slots), points.length - 1),
    );
    setActive(values[i] === null ? null : i);
  };
  const point = active === null ? null : points[active];

  return (
    <div ref={ref} className="relative min-w-0" style={{ height: HEIGHT }}>
      {measured !== null && (
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={label}
          className="block overflow-visible"
        >
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={MARGIN.left}
                x2={width - MARGIN.right}
                y1={y(tick)}
                y2={y(tick)}
                stroke={tick === 0 ? "var(--chart-axis)" : "var(--chart-grid)"}
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
          {points.map(
            (p, i) =>
              i % every === 0 && (
                <text
                  key={p.start}
                  x={x(i)}
                  y={HEIGHT - 8}
                  textAnchor="middle"
                  className="fill-muted-foreground text-[11px]"
                >
                  {bucketLabel(p.start, granularity, locale, crossesYears)}
                </text>
              ),
          )}
          {segments.map((segment) => (
            <g key={segment[0]!.i}>
              <path d={area(segment)} fill="var(--primary)" opacity={0.1} />
              <path
                d={line(segment)}
                fill="none"
                stroke="var(--primary)"
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </g>
          ))}
          {point && active !== null && point.value !== null && (
            <line
              x1={x(active)}
              x2={x(active)}
              y1={MARGIN.top}
              y2={MARGIN.top + innerH}
              stroke="var(--chart-axis)"
              shapeRendering="crispEdges"
            />
          )}
          {lastIndex >= 0 && (
            <>
              <circle
                cx={x(lastIndex)}
                cy={y(values[lastIndex]!)}
                r={5}
                fill="var(--primary)"
                stroke="var(--card)"
                strokeWidth={2}
              />
              <text
                x={x(lastIndex)}
                y={y(values[lastIndex]!) - 12}
                textAnchor={lastIndex > points.length / 2 ? "end" : "start"}
                className="fill-foreground text-xs font-semibold"
              >
                {formatMoney(values[lastIndex]!, currency, locale)}
              </text>
            </>
          )}
          {point &&
            active !== null &&
            point.value !== null &&
            active !== lastIndex && (
              <circle
                cx={x(active)}
                cy={y(point.value)}
                r={5}
                fill="var(--primary)"
                stroke="var(--card)"
                strokeWidth={2}
              />
            )}
          <rect
            x={MARGIN.left - band(innerW, slots) / 2}
            y={MARGIN.top}
            width={innerW + band(innerW, slots)}
            height={innerH}
            fill="transparent"
            onPointerMove={onMove}
            onPointerLeave={() => setActive(null)}
          />
        </svg>
      )}
      {point && active !== null && point.value !== null && (
        <div
          className="pointer-events-none absolute top-0 z-10 w-max rounded-lg border bg-card px-3 py-2 text-xs shadow-md"
          style={{
            left: Math.min(Math.max(0, x(active) - 70), width - 150),
          }}
        >
          <p className="mb-1 text-muted-foreground">
            {bucketTitle(point.at, "day", locale)}
          </p>
          <p className="font-semibold tabular-nums">
            {formatMoney(point.value, currency, locale)}
          </p>
        </div>
      )}
    </div>
  );
}

const band = (width: number, slots: number) => width / slots;
