import type { MinorUnits } from "./money";

/** Share of a budget spent from which it shows a warning. */
export const BUDGET_WARNING_RATIO = 0.8;

export type BudgetStatus = "ok" | "warning" | "over";

export function budgetStatus(
  spent: MinorUnits,
  limit: MinorUnits,
): BudgetStatus {
  if (spent > limit) return "over";
  if (spent >= limit * BUDGET_WARNING_RATIO) return "warning";
  return "ok";
}

/** First day (YYYY-MM-01) of the month that contains `day`. */
export function monthOf(day: string): string {
  return `${day.slice(0, 7)}-01`;
}

/** First day of the month `count` months after the one starting on `month`. */
export function addMonths(month: string, count: number): string {
  const [year, m] = month.split("-").map(Number) as [number, number];
  const index = year * 12 + (m - 1) + count;
  const mm = String((index % 12) + 1).padStart(2, "0");
  return `${Math.floor(index / 12)}-${mm}-01`;
}

/**
 * A budget limit applies from its month until a later version replaces it;
 * a version without an amount removes the budget from that month on.
 */
export type BudgetVersion = {
  categoryId: string;
  month: string;
  amount: MinorUnits | null;
  currency: string;
};

/** The limit of each category in `month`, from all stored versions. */
export function budgetsInMonth<V extends BudgetVersion>(
  versions: V[],
  month: string,
): Map<string, V & { amount: MinorUnits }> {
  const latest = new Map<string, V>();
  for (const version of versions) {
    if (version.month > month) continue;
    const current = latest.get(version.categoryId);
    if (!current || version.month > current.month) {
      latest.set(version.categoryId, version);
    }
  }
  const result = new Map<string, V & { amount: MinorUnits }>();
  for (const [categoryId, version] of latest) {
    if (version.amount !== null) {
      result.set(categoryId, version as V & { amount: MinorUnits });
    }
  }
  return result;
}
