import { addMonths, monthOf } from "./budget";
import type { MinorUnits } from "./money";

export const REPORT_PERIODS = [
  "thisMonth",
  "lastMonth",
  "3m",
  "6m",
  "12m",
  "thisYear",
  "lastYear",
] as const;

export type ReportPeriod = (typeof REPORT_PERIODS)[number];

export const isReportPeriod = (value: unknown): value is ReportPeriod =>
  REPORT_PERIODS.includes(value as ReportPeriod);

const lastDayOf = (month: string) => {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return `${month.slice(0, 8)}${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`;
};

/**
 * First and last day of a report period. Periods cover whole months: "3m" is
 * the current month and the two before it.
 */
export function periodRange(
  period: ReportPeriod,
  today: string,
): { from: string; to: string } {
  const month = monthOf(today);
  const months = (first: string, last: string) => ({
    from: first,
    to: lastDayOf(last),
  });
  switch (period) {
    case "thisMonth":
      return months(month, month);
    case "lastMonth":
      return months(addMonths(month, -1), addMonths(month, -1));
    case "3m":
      return months(addMonths(month, -2), month);
    case "6m":
      return months(addMonths(month, -5), month);
    case "12m":
      return months(addMonths(month, -11), month);
    case "thisYear":
      return months(`${today.slice(0, 4)}-01-01`, `${today.slice(0, 4)}-12-01`);
    case "lastYear": {
      const year = Number(today.slice(0, 4)) - 1;
      return months(`${year}-01-01`, `${year}-12-01`);
    }
  }
}

/** The period of the same length right before `from`…`to`. */
export function previousRange(from: string, to: string) {
  const [fy, fm] = from.split("-").map(Number) as [number, number];
  const [ty, tm] = to.split("-").map(Number) as [number, number];
  const length = (ty - fy) * 12 + (tm - fm) + 1;
  const start = addMonths(from, -length);
  return { from: start, to: lastDayOf(addMonths(from, -1)) };
}

export type Granularity = "day" | "month";

export type Bucket = {
  /** First day of the bucket. */
  start: string;
  /** Last day of the bucket. */
  end: string;
};

const nextDay = (day: string) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + 86_400_000)
    .toISOString()
    .slice(0, 10);

/** Days for a single month, months for anything longer. */
export function bucketsFor(
  from: string,
  to: string,
): {
  granularity: Granularity;
  buckets: Bucket[];
} {
  if (from.slice(0, 7) === to.slice(0, 7)) {
    const buckets: Bucket[] = [];
    for (let day = from; day <= to; day = nextDay(day)) {
      buckets.push({ start: day, end: day });
    }
    return { granularity: "day", buckets };
  }
  const buckets: Bucket[] = [];
  for (let month = monthOf(from); month <= to; month = addMonths(month, 1)) {
    buckets.push({ start: month, end: lastDayOf(month) });
  }
  return { granularity: "month", buckets };
}

/** Index of the bucket that contains `day`, or -1. */
export function bucketIndex(buckets: Bucket[], day: string): number {
  // Buckets are sorted and contiguous, so a binary search finds the day.
  let low = 0;
  let high = buckets.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const bucket = buckets[mid]!;
    if (day < bucket.start) high = mid - 1;
    else if (day > bucket.end) low = mid + 1;
    else return mid;
  }
  return -1;
}

export type BalanceFlow = { accountId: string; on: string; delta: MinorUnits };

/**
 * Balance of each account at the end of each given day. An account counts
 * from the day it was opened or its first transaction, whichever is earlier;
 * before that it does not exist yet (null).
 */
export function balancesAt(
  accounts: { id: string; openingBalance: MinorUnits; openedOn: string }[],
  flows: BalanceFlow[],
  days: string[],
): Map<string, (MinorUnits | null)[]> {
  const sorted = [...flows].sort((a, b) => (a.on < b.on ? -1 : 1));
  const result = new Map<string, (MinorUnits | null)[]>();
  for (const account of accounts) {
    const own = sorted.filter((f) => f.accountId === account.id);
    const start =
      own.length > 0 && own[0]!.on < account.openedOn
        ? own[0]!.on
        : account.openedOn;
    let balance = account.openingBalance;
    let i = 0;
    result.set(
      account.id,
      days.map((day) => {
        while (i < own.length && own[i]!.on <= day) balance += own[i++]!.delta;
        return day < start ? null : balance;
      }),
    );
  }
  return result;
}

/** Share of `part` in `total` as a percentage, 0 when there is no total. */
export const share = (part: number, total: number) =>
  total > 0 ? (part / total) * 100 : 0;

/** Change from `before` to `now` in percent, or null when `before` is 0. */
export const changePercent = (now: number, before: number) =>
  before === 0 ? null : ((now - before) / Math.abs(before)) * 100;
