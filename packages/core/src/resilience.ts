/**
 * Financial resilience: how long the money would last if income stopped
 * today, and what changes that. Every figure comes with the inputs behind
 * it, so the app can explain a level instead of only showing a score.
 */
import type { MinorUnits } from "./money";
import type { Frequency } from "./recurring";

export const RESILIENCE_LEVELS = [
  "weak",
  "building",
  "good",
  "strong",
] as const;
export type ResilienceLevel = (typeof RESILIENCE_LEVELS)[number];

/** A regular payment spread over a month: weekly × 52 / 12, yearly / 12. */
export function monthlyEquivalent(
  amount: MinorUnits,
  frequency: Frequency,
  interval: number,
): MinorUnits {
  const perYear =
    frequency === "weekly"
      ? 52 / interval
      : frequency === "monthly"
        ? 12 / interval
        : 1 / interval;
  return Math.round((amount * perYear) / 12);
}

/** Months that `reserve` covers at `monthly` spending; null without spending. */
export function runway(
  reserve: MinorUnits,
  monthly: MinorUnits,
): number | null {
  if (monthly <= 0) return null;
  return Math.max(0, reserve) / monthly;
}

export function resilienceLevel(months: number | null): ResilienceLevel {
  if (months === null || months >= 6) return "strong";
  if (months >= 3) return "good";
  if (months >= 1) return "building";
  return "weak";
}

export type Resilience = {
  /** All account balances, card debt subtracted. */
  reserve: MinorUnits;
  /** The reserve once the payments of the next 30 days are made. */
  afterUpcoming: MinorUnits;
  /** Months covered at the usual monthly spending. */
  months: number | null;
  /** Months covered by essential payments alone. */
  essentialMonths: number | null;
  level: ResilienceLevel;
  scenarios: {
    /** Income 20% lower: what is left (or missing) each month. */
    incomeDrop: { monthlyNet: MinorUnits; months: number | null };
    /** An unexpected expense paid from the reserve. */
    shock: { amount: MinorUnits; months: number | null };
  };
};

export function resilience({
  reserve,
  upcoming30,
  averageIncome,
  averageExpense,
  essentialMonthly,
  shock,
}: {
  reserve: MinorUnits;
  /** Payments due in the next 30 days (positive). */
  upcoming30: MinorUnits;
  averageIncome: MinorUnits;
  averageExpense: MinorUnits;
  essentialMonthly: MinorUnits;
  shock: MinorUnits;
}): Resilience {
  // Without a spending history, regular payments are the best guess.
  const monthly = averageExpense > 0 ? averageExpense : essentialMonthly;
  const months = runway(reserve, monthly);
  const dropNet = Math.round(averageIncome * 0.8) - monthly;
  return {
    reserve,
    afterUpcoming: reserve - upcoming30,
    months,
    essentialMonths: runway(reserve, essentialMonthly),
    level: resilienceLevel(months),
    scenarios: {
      incomeDrop: {
        monthlyNet: dropNet,
        months: dropNet < 0 ? runway(reserve, -dropNet) : null,
      },
      shock: { amount: shock, months: runway(reserve - shock, monthly) },
    },
  };
}
