"use client";

import { useState } from "react";

export type DonutSlice = {
  key: string;
  label: string;
  value: number;
  /** Shown in the middle while the slice is hovered or focused. */
  amount: string;
  percent: string;
  color: string;
};

const SIZE = 200;
const OUTER = 96;
const INNER = 62;

/** Keeps a name inside the ring's hole. */
const truncate = (text: string) =>
  text.length > 16 ? `${text.slice(0, 15)}…` : text;

/** One ring segment from angle a0 to a1 (radians, clockwise from the top). */
function segment(a0: number, a1: number) {
  const point = (r: number, a: number) =>
    `${(SIZE / 2 + r * Math.sin(a)).toFixed(2)} ${(SIZE / 2 - r * Math.cos(a)).toFixed(2)}`;
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return [
    `M${point(OUTER, a0)}`,
    `A${OUTER} ${OUTER} 0 ${large} 1 ${point(OUTER, a1)}`,
    `L${point(INNER, a1)}`,
    `A${INNER} ${INNER} 0 ${large} 0 ${point(INNER, a0)}`,
    "Z",
  ].join("");
}

/**
 * A ring of slices for part-to-whole. The middle shows the total, or the
 * hovered slice. Exact figures stay in the list next to it.
 */
export function DonutChart({
  slices,
  total,
  totalLabel,
  label,
}: {
  slices: DonutSlice[];
  total: string;
  totalLabel: string;
  /** What the chart shows, for screen readers. */
  label: string;
}) {
  const [active, setActive] = useState<string | null>(null);
  const sum = slices.reduce((s, x) => s + x.value, 0);
  const shown = slices.find((s) => s.key === active);

  // Each slice starts where the ones before it end.
  const starts = slices.map((_, i) =>
    slices.slice(0, i).reduce((a, x) => a + x.value, 0),
  );
  const arcs = slices.map((slice, i) => {
    const turn = (value: number) => (sum > 0 ? (value / sum) * Math.PI * 2 : 0);
    const a0 = turn(starts[i]!);
    // A single slice is a full ring, which one arc cannot draw.
    const a1 =
      slices.length === 1
        ? Math.PI * 2 - 0.0001
        : turn(starts[i]! + slice.value);
    return { slice, d: segment(a0, a1) };
  });

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      role="img"
      aria-label={label}
      className="aspect-square w-full max-w-56"
      onMouseLeave={() => setActive(null)}
    >
      {arcs.map(({ slice, d }) => (
        <path
          key={slice.key}
          d={d}
          fill={slice.color}
          // A thin ring in the card colour separates neighbouring slices.
          stroke="var(--card)"
          strokeWidth={2}
          strokeLinejoin="round"
          opacity={active && active !== slice.key ? 0.35 : 1}
          className="cursor-default transition-opacity duration-150"
          onMouseEnter={() => setActive(slice.key)}
        >
          <title>{`${slice.label}: ${slice.amount} (${slice.percent})`}</title>
        </path>
      ))}
      <text
        x={SIZE / 2}
        y={SIZE / 2 - 8}
        textAnchor="middle"
        className="pointer-events-none fill-muted-foreground text-[11px]"
      >
        {shown ? `${truncate(shown.label)} · ${shown.percent}` : totalLabel}
      </text>
      <text
        x={SIZE / 2}
        y={SIZE / 2 + 14}
        textAnchor="middle"
        className="pointer-events-none fill-foreground text-[17px] font-semibold tabular-nums"
      >
        {shown ? shown.amount : total}
      </text>
    </svg>
  );
}
