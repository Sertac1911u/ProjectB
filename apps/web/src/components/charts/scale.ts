import { CURRENCIES, type CurrencyCode } from "@projectb/core";

/** Round tick values covering min…max, about `count` of them. */
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (min === max) {
    if (max === 0) return [0, 1];
    min = Math.min(0, min);
    max = Math.max(0, max);
  }
  const raw = (max - min) / count;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step =
    [1, 2, 2.5, 5, 10].map((m) => m * power).find((s) => s >= raw) ??
    10 * power;
  const first = Math.floor(min / step) * step;
  const ticks: number[] = [];
  for (let v = first; v < max + step / 2; v += step) {
    ticks.push(Math.round(v * 1e6) / 1e6);
  }
  if (ticks.length < 2) ticks.push(first + step);
  return ticks;
}

/**
 * Short axis label for an amount in minor units, e.g. "₺12 B" or "$1.5K",
 * with the symbol on the side the locale puts it for full amounts.
 */
export function compactMoney(
  minor: number,
  currency: CurrencyCode,
  locale: string,
): string {
  const parts = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
  }).formatToParts(1);
  const symbol = parts.find((p) => p.type === "currency")?.value ?? currency;
  const symbolFirst =
    parts.findIndex((p) => p.type === "currency") <
    parts.findIndex((p) => p.type === "integer");
  const number = new Intl.NumberFormat(locale, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(minor / 10 ** CURRENCIES[currency].minorUnits);
  if (number.startsWith("-")) {
    const rest = number.slice(1);
    return symbolFirst ? `-${symbol}${rest}` : `-${rest} ${symbol}`;
  }
  return symbolFirst ? `${symbol}${number}` : `${number} ${symbol}`;
}

/** Label of a bucket: "17" for days, "Eki" (or "Eki 26" across years) for months. */
export function bucketLabel(
  start: string,
  granularity: "day" | "month",
  locale: string,
  withYear = false,
): string {
  const date = new Date(`${start}T00:00:00Z`);
  if (granularity === "day") return String(date.getUTCDate());
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    ...(withYear ? { year: "2-digit" } : {}),
    timeZone: "UTC",
  }).format(date);
}

/** Full label for tooltips: "17 Ekim 2026" or "Ekim 2026". */
export function bucketTitle(
  start: string,
  granularity: "day" | "month",
  locale: string,
): string {
  return new Intl.DateTimeFormat(locale, {
    ...(granularity === "day" ? { day: "numeric" } : {}),
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${start}T00:00:00Z`));
}

/** A column path with a 4px rounded top and a square base. */
export function columnPath(x: number, y: number, w: number, h: number) {
  if (h <= 0) return "";
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}
