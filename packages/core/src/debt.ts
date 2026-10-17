/**
 * Debt payoff plans: how long it takes to clear several debts with a fixed
 * monthly budget, and how much interest that costs, depending on which debt
 * gets the money left over after the minimum payments.
 */
import type { MinorUnits } from "./money";

export const DEBT_STRATEGIES = ["smallest", "highestRate"] as const;
export type DebtStrategy = (typeof DEBT_STRATEGIES)[number];

/** Plans longer than this are reported as not finishing. */
export const MAX_PLAN_MONTHS = 600;

export type Debt = {
  id: string;
  balance: MinorUnits;
  /** Monthly interest rate as a fraction: 0.0349 for 3,49% a month. */
  monthlyRate: number;
  minimumPayment: MinorUnits;
};

export type DebtPlan = {
  /** Months until every debt is paid, or null if the budget never gets there. */
  months: number | null;
  totalInterest: MinorUnits;
  /** Month (1-based) each debt is paid off in. */
  payoffMonth: Record<string, number>;
  /** What each debt gets in each of the first months. */
  schedule: { month: number; payments: Record<string, MinorUnits> }[];
};

const order = (strategy: DebtStrategy) =>
  strategy === "smallest"
    ? (a: { balance: number; monthlyRate: number }, b: typeof a) =>
        a.balance - b.balance || b.monthlyRate - a.monthlyRate
    : (a: { balance: number; monthlyRate: number }, b: typeof a) =>
        b.monthlyRate - a.monthlyRate || a.balance - b.balance;

/**
 * Pays `budget` a month: every debt gets its minimum, the rest goes to the
 * debt the strategy picks, and money freed by a paid-off debt rolls on.
 */
export function planDebts(
  debts: Debt[],
  budget: MinorUnits,
  strategy: DebtStrategy,
  scheduleMonths = 12,
): DebtPlan {
  const active = debts.filter((d) => d.balance > 0).map((d) => ({ ...d }));
  const minimums = active.reduce((sum, d) => sum + d.minimumPayment, 0);
  const monthly = Math.max(budget, minimums);
  const payoffMonth: Record<string, number> = {};
  const schedule: DebtPlan["schedule"] = [];
  let totalInterest = 0;

  for (let month = 1; month <= MAX_PLAN_MONTHS; month++) {
    const open = active.filter((d) => d.balance > 0);
    if (open.length === 0) {
      return { months: month - 1, totalInterest, payoffMonth, schedule };
    }
    const owedBefore = open.reduce((sum, d) => sum + d.balance, 0);
    for (const debt of open) {
      const interest = Math.round(debt.balance * debt.monthlyRate);
      debt.balance += interest;
      totalInterest += interest;
    }
    const payments: Record<string, MinorUnits> = {};
    let left = monthly;
    for (const debt of open) {
      const pay = Math.min(debt.minimumPayment, debt.balance, left);
      debt.balance -= pay;
      left -= pay;
      payments[debt.id] = pay;
    }
    for (const debt of [...open].sort(order(strategy))) {
      if (left <= 0) break;
      const pay = Math.min(debt.balance, left);
      debt.balance -= pay;
      left -= pay;
      payments[debt.id] = (payments[debt.id] ?? 0) + pay;
    }
    for (const debt of open) {
      if (debt.balance <= 0 && !(debt.id in payoffMonth)) {
        payoffMonth[debt.id] = month;
      }
    }
    if (month <= scheduleMonths) schedule.push({ month, payments });
    // Interest eats the whole payment: the plan would never finish.
    const owedAfter = active.reduce(
      (sum, d) => sum + Math.max(0, d.balance),
      0,
    );
    if (owedAfter >= owedBefore) {
      return { months: null, totalInterest, payoffMonth, schedule };
    }
  }
  return { months: null, totalInterest, payoffMonth, schedule };
}

/**
 * The smallest monthly budget that clears all debts within `months`, using
 * the given strategy. Null if no budget up to the total owed does it.
 */
export function budgetToFinishIn(
  debts: Debt[],
  months: number,
  strategy: DebtStrategy,
): MinorUnits | null {
  const owed = debts.reduce((sum, d) => sum + Math.max(0, d.balance), 0);
  if (owed === 0) return 0;
  let low = debts.reduce((sum, d) => sum + d.minimumPayment, 0);
  // Paying everything plus a month of interest always finishes in one month.
  let high = Math.ceil(
    debts.reduce((sum, d) => sum + d.balance * (1 + d.monthlyRate), 0),
  );
  const fits = (budget: number) => {
    const plan = planDebts(debts, budget, strategy, 0);
    return plan.months !== null && plan.months <= months;
  };
  if (fits(low)) return low;
  if (!fits(high)) return null;
  while (high - low > 100) {
    const mid = Math.floor((low + high) / 2);
    if (fits(mid)) high = mid;
    else low = mid;
  }
  // Round up to whole currency units.
  return Math.ceil(high / 100) * 100;
}
