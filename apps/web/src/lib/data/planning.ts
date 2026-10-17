import "server-only";
import {
  type BudgetStatus,
  budgetsInMonth,
  budgetStatus,
  type CurrencyCode,
  convert,
  DEFAULT_CURRENCY,
  goalProgress,
  isCurrencyCode,
  type Rates,
} from "@projectb/core";
import {
  accounts,
  budgets,
  expenseEntries,
  goalContributions,
  goals,
} from "@projectb/db";
import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";
import { cache } from "react";
import { getProfile, withUser } from "@/lib/auth";
import { monthRange, today } from "@/lib/dates";
import { type CategoryRow, getAccounts, getCategories } from "./finance";
import { getRates } from "./rates";
import { materializeRecurring } from "./recurring";

const code = (c: string): CurrencyCode =>
  isCurrencyCode(c) ? c : DEFAULT_CURRENCY;

export const getBudgetVersions = cache(async () =>
  withUser((tx) =>
    tx
      .select({
        categoryId: budgets.categoryId,
        month: budgets.month,
        amount: budgets.amount,
        currency: budgets.currency,
      })
      .from(budgets)
      .orderBy(asc(budgets.month)),
  ),
);

/** Expenses per category and account currency between two dates. */
export const getCategorySpending = cache(async (from: string, to: string) => {
  await materializeRecurring();
  return withUser((tx) =>
    tx
      .select({
        categoryId: expenseEntries.categoryId,
        currency: accounts.currency,
        total: sql<number>`sum(${expenseEntries.amount})::bigint`.mapWith(
          Number,
        ),
      })
      .from(expenseEntries)
      .innerJoin(accounts, eq(accounts.id, expenseEntries.accountId))
      .where(
        and(gte(expenseEntries.entryOn, from), lte(expenseEntries.entryOn, to)),
      )
      .groupBy(expenseEntries.categoryId, accounts.currency),
  );
});

type Spending = Awaited<ReturnType<typeof getCategorySpending>>;

/** Spending of the given categories converted to one currency. */
function spentIn(
  rows: Spending,
  categoryIds: Set<string | null>,
  currency: CurrencyCode,
  rates: Rates,
) {
  let spent = 0;
  let missing = false;
  for (const row of rows) {
    if (!categoryIds.has(row.categoryId)) continue;
    const converted = convert(row.total, code(row.currency), currency, rates);
    if (converted === null) missing = true;
    else spent += converted;
  }
  return { spent, missing };
}

export type BudgetLine = {
  category: CategoryRow;
  amount: number;
  currency: CurrencyCode;
  spent: number;
  status: BudgetStatus;
  /** Some spending is in a currency without a known rate. */
  missing: boolean;
  /** A parent category's budget already includes this one. */
  insideParent: boolean;
};

/**
 * Budgets of a month with what has been spent against them. A parent
 * category's budget counts its subcategories too.
 */
export async function getBudgetOverview(month: string) {
  const { from, to } = monthRange(month);
  const [versions, spending, categories, rateInfo, profile] = await Promise.all(
    [
      getBudgetVersions(),
      getCategorySpending(from, to),
      getCategories(),
      getRates(),
      getProfile(),
    ],
  );
  const { rates } = rateInfo;
  const baseCurrency = code(profile.baseCurrency);
  const limits = budgetsInMonth(versions, month);
  const childrenOf = (id: string) =>
    categories.filter((c) => c.parentId === id).map((c) => c.id);

  const lines: BudgetLine[] = [];
  for (const category of categories) {
    const budget = limits.get(category.id);
    if (!budget) continue;
    const currency = code(budget.currency);
    const ids = new Set<string | null>([
      category.id,
      ...childrenOf(category.id),
    ]);
    const { spent, missing } = spentIn(spending, ids, currency, rates);
    lines.push({
      category,
      amount: budget.amount,
      currency,
      spent,
      status: budgetStatus(spent, budget.amount),
      missing,
      insideParent: Boolean(category.parentId && limits.has(category.parentId)),
    });
  }

  // Totals count each budget once: subcategory budgets are already part of
  // their parent's.
  const total = { amount: 0, spent: 0, missing: false };
  for (const line of lines.filter((l) => !l.insideParent)) {
    const amount = convert(line.amount, line.currency, baseCurrency, rates);
    const spent = convert(line.spent, line.currency, baseCurrency, rates);
    if (amount === null || spent === null) total.missing = true;
    else {
      total.amount += amount;
      total.spent += spent;
    }
    if (line.missing) total.missing = true;
  }

  // Spending not covered by any budget, per top-level category.
  const covered = new Set<string | null>();
  for (const line of lines) {
    covered.add(line.category.id);
    for (const id of childrenOf(line.category.id)) covered.add(id);
  }
  const unbudgeted: { category: CategoryRow | null; spent: number }[] = [];
  const topLevel = categories.filter(
    (c) => c.kind === "expense" && !c.parentId,
  );
  for (const parent of [null, ...topLevel]) {
    const ids = parent
      ? [parent.id, ...childrenOf(parent.id)].filter((id) => !covered.has(id))
      : [null];
    const { spent } = spentIn(spending, new Set(ids), baseCurrency, rates);
    if (spent > 0) unbudgeted.push({ category: parent, spent });
  }
  unbudgeted.sort((a, b) => b.spent - a.spent);

  return { lines, total, unbudgeted, baseCurrency, rateInfo };
}

/** Goals with their progress, active ones first. */
export const getGoals = cache(async () => {
  const [rows, contributions, accountList] = await Promise.all([
    withUser((tx) =>
      tx
        .select()
        .from(goals)
        .orderBy(
          sql`${goals.archivedAt} is not null`,
          sql`${goals.targetDate} asc nulls last`,
          asc(goals.createdAt),
        ),
    ),
    withUser((tx) =>
      tx
        .select({
          goalId: goalContributions.goalId,
          total: sql<number>`sum(${goalContributions.amount})::bigint`.mapWith(
            Number,
          ),
        })
        .from(goalContributions)
        .groupBy(goalContributions.goalId),
    ),
    getAccounts(),
  ]);
  const day = today();
  return rows.map((goal) => {
    const account = goal.accountId
      ? (accountList.find((a) => a.id === goal.accountId) ?? null)
      : null;
    const saved = account
      ? account.balance
      : (contributions.find((c) => c.goalId === goal.id)?.total ?? 0);
    return {
      ...goal,
      currency: code(goal.currency),
      account,
      progress: goalProgress(goal.targetAmount, saved, goal.targetDate, day),
    };
  });
});

export type GoalWithProgress = Awaited<ReturnType<typeof getGoals>>[number];

export async function getGoalContributions(goalId: string) {
  return withUser((tx) =>
    tx
      .select()
      .from(goalContributions)
      .where(eq(goalContributions.goalId, goalId))
      .orderBy(
        desc(goalContributions.occurredOn),
        desc(goalContributions.createdAt),
      ),
  );
}

/** Accounts a goal can follow: anything but credit cards. */
export async function goalAccounts(keepId?: string | null) {
  const accounts = await getAccounts();
  return accounts
    .filter(
      (a) => a.type !== "credit_card" && (!a.archivedAt || a.id === keepId),
    )
    .map((a) => ({
      id: a.id,
      name: a.name,
      currency: isCurrencyCode(a.currency) ? a.currency : DEFAULT_CURRENCY,
    }));
}
