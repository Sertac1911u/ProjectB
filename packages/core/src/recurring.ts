/**
 * Schedules of recurring transactions. Occurrence k (0-based) falls k steps
 * after the start date, always counted from the start, so a schedule on the
 * 31st lands on 28 Feb and still returns to 31 Mar. The database function
 * public.recurring_date computes the same dates.
 */

export const FREQUENCIES = ["weekly", "monthly", "yearly"] as const;
export type Frequency = (typeof FREQUENCIES)[number];

export const MAX_INTERVAL = 12;
export const MAX_OCCURRENCES = 360;

export type Schedule = {
  startOn: string;
  frequency: Frequency;
  /** Every `interval` weeks, months or years. */
  interval: number;
  /** Last day an occurrence may fall on. */
  endOn?: string | null;
  /** Stop after this many occurrences. */
  maxOccurrences?: number | null;
};

const pad = (n: number) => String(n).padStart(2, "0");

export function occurrenceDate(
  schedule: Pick<Schedule, "startOn" | "frequency" | "interval">,
  k: number,
): string {
  const [y, m, d] = schedule.startOn.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  if (schedule.frequency === "weekly") {
    return new Date(Date.UTC(y, m - 1, d + 7 * schedule.interval * k))
      .toISOString()
      .slice(0, 10);
  }
  const months =
    (schedule.frequency === "monthly" ? 1 : 12) * schedule.interval * k;
  const first = new Date(Date.UTC(y, m - 1 + months, 1));
  const year = first.getUTCFullYear();
  const month = first.getUTCMonth() + 1;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${pad(month)}-${pad(Math.min(d, last))}`;
}

/** Whether occurrence k is still part of the schedule. */
export function isWithinSchedule(schedule: Schedule, k: number): boolean {
  if (schedule.maxOccurrences != null && k >= schedule.maxOccurrences)
    return false;
  if (schedule.endOn && occurrenceDate(schedule, k) > schedule.endOn)
    return false;
  return true;
}

/**
 * Index of the first occurrence after `day`, or null when the schedule ends
 * before that. Used to continue a schedule without repeating past entries.
 */
export function firstOccurrenceAfter(
  schedule: Schedule,
  day: string,
): number | null {
  // Linear, but schedules hold at most a few hundred occurrences in practice;
  // the cap only guards against runaway loops.
  let k = 0;
  while (isWithinSchedule(schedule, k)) {
    if (occurrenceDate(schedule, k) > day) return k;
    k++;
    if (k > 100_000) return null;
  }
  return null;
}

/** The next `count` occurrences from index `from`, within the schedule. */
export function upcomingOccurrences(
  schedule: Schedule,
  from: number,
  count: number,
): string[] {
  const dates: string[] = [];
  for (
    let k = from;
    dates.length < count && isWithinSchedule(schedule, k);
    k++
  ) {
    dates.push(occurrenceDate(schedule, k));
  }
  return dates;
}
