/** Time zone used for "today" and month boundaries until users can pick one. */
export const TIME_ZONE = "Europe/Istanbul";

/** Today's date as YYYY-MM-DD in the given time zone. */
export function today(timeZone = TIME_ZONE, now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(now);
}

/** First and last day of the month that contains `day` (YYYY-MM-DD). */
export function monthRange(day: string): { from: string; to: string } {
  const [year, month] = day.split("-").map(Number) as [number, number];
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const mm = String(month).padStart(2, "0");
  return {
    from: `${year}-${mm}-01`,
    to: `${year}-${mm}-${String(last).padStart(2, "0")}`,
  };
}

/** Formats a calendar date (YYYY-MM-DD) without shifting it across time zones. */
export function formatDay(
  day: string,
  locale: string,
  style: "long" | "medium" = "long",
) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: style,
    timeZone: "UTC",
  }).format(new Date(`${day}T00:00:00Z`));
}

/** Whole days from `from` to `to` (both YYYY-MM-DD); negative if `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  const ms = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}
