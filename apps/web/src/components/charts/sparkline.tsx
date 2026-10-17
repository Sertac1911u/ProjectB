/** A small trend line without axes, for stat tiles. */
export function Sparkline({
  values,
  label,
  width = 120,
  height = 32,
}: {
  values: (number | null)[];
  label: string;
  width?: number;
  height?: number;
}) {
  const known = values.filter((v): v is number => v !== null);
  if (known.length < 2) return null;
  const min = Math.min(...known);
  const max = Math.max(...known);
  const x = (i: number) => 2 + (i / (values.length - 1)) * (width - 4);
  const y = (v: number) =>
    max === min ? height / 2 : 2 + (1 - (v - min) / (max - min)) * (height - 4);
  const d = values
    .map((v, i) => (v === null ? null : `${x(i)},${y(v)}`))
    .filter(Boolean)
    .map((p, k) => `${k ? "L" : "M"}${p}`)
    .join("");
  const last = values.findLastIndex((v) => v !== null);
  return (
    <svg
      width={width}
      height={height}
      role="img"
      aria-label={label}
      className="overflow-visible"
    >
      <path
        d={d}
        fill="none"
        stroke="var(--muted-foreground)"
        strokeOpacity={0.6}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle
        cx={x(last)}
        cy={y(values[last]!)}
        r={3}
        fill="var(--primary)"
        stroke="var(--card)"
        strokeWidth={1.5}
      />
    </svg>
  );
}
