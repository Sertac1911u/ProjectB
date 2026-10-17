import type { MinorUnits } from "./money";

/**
 * Months left to save towards a target date, counting the current month:
 * on 17 October a goal due 31 December has 3 (October, November, December),
 * one due 10 November has 1. Zero once the date has passed.
 */
export function monthsLeft(today: string, targetDate: string): number {
  if (targetDate < today) return 0;
  const [y1, m1, d1] = today.split("-").map(Number) as [number, number, number];
  const [y2, m2, d2] = targetDate.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  return (y2 - y1) * 12 + (m2 - m1) + (d2 >= d1 ? 1 : 0);
}

export type GoalProgress = {
  saved: MinorUnits;
  remaining: MinorUnits;
  /** 0 to 100. */
  percent: number;
  reached: boolean;
  /** Null without a target date, or once reached or overdue. */
  monthsLeft: number | null;
  /** What to put aside each month to make the target date. */
  monthlyNeeded: MinorUnits | null;
  overdue: boolean;
};

export function goalProgress(
  target: MinorUnits,
  saved: MinorUnits,
  targetDate: string | null,
  today: string,
): GoalProgress {
  const kept = Math.max(0, saved);
  const remaining = Math.max(0, target - kept);
  const reached = remaining === 0;
  const months = targetDate && !reached ? monthsLeft(today, targetDate) : null;
  return {
    saved: kept,
    remaining,
    percent: target > 0 ? Math.min(100, (kept / target) * 100) : 100,
    reached,
    monthsLeft: months || null,
    monthlyNeeded: months ? Math.ceil(remaining / months) : null,
    overdue: months === 0,
  };
}

/** Average month length in days, for turning months into days. */
const DAYS_PER_MONTH = 30.44;

/**
 * Days by which spending `amount` pushes back reaching a goal, given what is
 * saved in a typical month. Null when nothing is being saved.
 */
export function goalDelayDays(
  amount: MinorUnits,
  monthlySaving: MinorUnits | null,
): number | null {
  if (!monthlySaving || monthlySaving <= 0) return null;
  return Math.ceil((amount / monthlySaving) * DAYS_PER_MONTH);
}

const addDays = (day: string, days: number) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + days * 86_400_000)
    .toISOString()
    .slice(0, 10);

export type GoalForecast = {
  /** Expected day the goal is reached, or null at no or negative saving. */
  reachOn: string | null;
  /** Whether that is on or before the target date (null without one). */
  onTime: boolean | null;
};

/** When saving `monthly` closes the gap of `remaining`. */
export function goalForecast(
  remaining: MinorUnits,
  monthly: MinorUnits | null,
  today: string,
  targetDate: string | null,
): GoalForecast {
  if (remaining <= 0) return { reachOn: today, onTime: true };
  if (!monthly || monthly <= 0) {
    return { reachOn: null, onTime: targetDate ? false : null };
  }
  const reachOn = addDays(
    today,
    Math.ceil((remaining / monthly) * DAYS_PER_MONTH),
  );
  return { reachOn, onTime: targetDate ? reachOn <= targetDate : null };
}
