import "server-only";
import {
  addMonths,
  balancesAt,
  type BalanceFlow,
  bucketIndex,
  bucketsFor,
  type CurrencyCode,
  convert,
  DEFAULT_CURRENCY,
  goldValue,
  isCurrencyCode,
  monthOf,
  periodRange,
  type Rates,
} from "@projectb/core";
import { accounts, expenseEntries, transactions } from "@projectb/db";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { cache } from "react";
import { getProfile, withUser } from "@/lib/auth";
import { TIME_ZONE, today } from "@/lib/dates";
import { getCategories } from "./finance";
import { getCategorySpending } from "./planning";
import { getRates } from "./rates";
import { materializeRecurring } from "./recurring";

const code = (c: string): CurrencyCode =>
  isCurrencyCode(c) ? c : DEFAULT_CURRENCY;

/** Converts amounts into one currency and notes whether a rate was missing. */
function converter(to: CurrencyCode, rates: Rates) {
  const state = { missing: false };
  return {
    state,
    add(amount: number, currency: string) {
      const converted = convert(amount, code(currency), to, rates);
      if (converted === null) {
        state.missing = true;
        return 0;
      }
      return converted;
    },
  };
}

/** Income and expenses per day and account currency in a date range. */
const getDailyTotals = cache(async (from: string, to: string) => {
  await materializeRecurring();
  return withUser(async (tx) => {
    const [income, expense] = await Promise.all([
      tx
        .select({
          on: transactions.occurredOn,
          currency: accounts.currency,
          total: sql<number>`sum(${transactions.amount})::bigint`.mapWith(
            Number,
          ),
        })
        .from(transactions)
        .innerJoin(accounts, eq(accounts.id, transactions.accountId))
        .where(
          and(
            eq(transactions.kind, "income"),
            gte(transactions.occurredOn, from),
            lte(transactions.occurredOn, to),
          ),
        )
        .groupBy(transactions.occurredOn, accounts.currency),
      tx
        .select({
          on: expenseEntries.entryOn,
          currency: accounts.currency,
          total: sql<number>`sum(${expenseEntries.amount})::bigint`.mapWith(
            Number,
          ),
        })
        .from(expenseEntries)
        .innerJoin(accounts, eq(accounts.id, expenseEntries.accountId))
        .where(
          and(
            gte(expenseEntries.entryOn, from),
            lte(expenseEntries.entryOn, to),
          ),
        )
        .groupBy(expenseEntries.entryOn, accounts.currency),
    ]);
    return { income, expense };
  });
});

/**
 * Income and expenses of each day or month of a range, in the main currency
 * at the latest rates. Installments count in the month they are paid.
 */
export async function getCashFlow(from: string, to: string) {
  const [{ income, expense }, rateInfo, profile] = await Promise.all([
    getDailyTotals(from, to),
    getRates(),
    getProfile(),
  ]);
  const currency = code(profile.baseCurrency);
  const { granularity, buckets } = bucketsFor(from, to);
  const sums = converter(currency, rateInfo.rates);
  const rows = buckets.map((bucket) => ({ ...bucket, income: 0, expense: 0 }));
  for (const row of income) {
    const i = bucketIndex(buckets, row.on);
    if (i >= 0) rows[i]!.income += sums.add(row.total, row.currency);
  }
  for (const row of expense) {
    const i = bucketIndex(buckets, row.on);
    if (i >= 0) rows[i]!.expense += sums.add(row.total, row.currency);
  }
  return {
    granularity,
    rows,
    totals: {
      income: rows.reduce((s, r) => s + r.income, 0),
      expense: rows.reduce((s, r) => s + r.expense, 0),
    },
    currency,
    missing: sums.state.missing,
    rateInfo,
  };
}

/** Income per category and account currency in a date range. */
const getCategoryIncome = cache(async (from: string, to: string) => {
  await materializeRecurring();
  return withUser((tx) =>
    tx
      .select({
        categoryId: transactions.categoryId,
        currency: accounts.currency,
        total: sql<number>`sum(${transactions.amount})::bigint`.mapWith(Number),
      })
      .from(transactions)
      .innerJoin(accounts, eq(accounts.id, transactions.accountId))
      .where(
        and(
          eq(transactions.kind, "income"),
          gte(transactions.occurredOn, from),
          lte(transactions.occurredOn, to),
        ),
      )
      .groupBy(transactions.categoryId, accounts.currency),
  );
});

export type CategoryShare = {
  /** Null for transactions without a category. */
  categoryId: string | null;
  total: number;
  children: { categoryId: string; total: number }[];
};

/**
 * Totals per top-level category (subcategories rolled up, and listed on
 * their own), largest first, in the main currency.
 */
export async function getCategoryBreakdown(
  kind: "expense" | "income",
  from: string,
  to: string,
) {
  const [rows, categories, rateInfo, profile] = await Promise.all([
    kind === "expense"
      ? getCategorySpending(from, to)
      : getCategoryIncome(from, to),
    getCategories(),
    getRates(),
    getProfile(),
  ]);
  const currency = code(profile.baseCurrency);
  const sums = converter(currency, rateInfo.rates);
  const byCategory = new Map<string | null, number>();
  for (const row of rows) {
    byCategory.set(
      row.categoryId,
      (byCategory.get(row.categoryId) ?? 0) + sums.add(row.total, row.currency),
    );
  }
  const parentOf = (id: string | null) => {
    const category = id ? categories.find((c) => c.id === id) : undefined;
    return category?.parentId ?? id;
  };
  const groups = new Map<string | null, CategoryShare>();
  for (const [categoryId, total] of byCategory) {
    if (total === 0) continue;
    const parentId = parentOf(categoryId);
    const group = groups.get(parentId) ?? {
      categoryId: parentId,
      total: 0,
      children: [],
    };
    group.total += total;
    if (categoryId !== parentId && categoryId) {
      group.children.push({ categoryId, total });
    }
    groups.set(parentId, group);
  }
  const shares = [...groups.values()].sort((a, b) => b.total - a.total);
  for (const group of shares) group.children.sort((a, b) => b.total - a.total);
  return {
    shares,
    total: shares.reduce((s, g) => s + g.total, 0),
    currency,
    missing: sums.state.missing,
  };
}

/** Every change to account balances, summed per account and day. */
const getBalanceFlows = cache(async (to: string) => {
  await materializeRecurring();
  return withUser(async (tx) => {
    const [flows, opened] = await Promise.all([
      tx.execute<{ account_id: string; on: string; delta: string }>(sql`
        select account_id, "on"::text, sum(delta)::bigint as delta from (
          select ${transactions.accountId} as account_id, ${transactions.occurredOn} as "on",
            case when ${transactions.kind} = 'income' then ${transactions.amount}
              else -${transactions.amount} end as delta
          from ${transactions}
          where ${transactions.occurredOn} <= ${to}
          union all
          select ${transactions.toAccountId}, ${transactions.occurredOn}, ${transactions.toAmount}
          from ${transactions}
          where ${transactions.kind} = 'transfer' and ${transactions.occurredOn} <= ${to}
        ) changes
        group by account_id, "on"
      `),
      tx
        .select({
          id: accounts.id,
          type: accounts.type,
          currency: accounts.currency,
          goldQuantity: accounts.goldQuantity,
          unitPrice: accounts.unitPrice,
          openingBalance: accounts.openingBalance,
          openedOn: sql<string>`(${accounts.createdAt} at time zone ${TIME_ZONE})::date::text`,
        })
        .from(accounts),
    ]);
    return {
      flows: flows.map((f): BalanceFlow => ({
        accountId: f.account_id,
        on: f.on,
        delta: Number(f.delta),
      })),
      accounts: opened,
    };
  });
});

/**
 * Net worth (all account balances, card debt included) at the end of each
 * day or month of a range, at the latest rates. Days after today are left out.
 */
export async function getNetWorthHistory(from: string, to: string) {
  const day = today();
  const [{ flows, accounts: accountList }, rateInfo, profile] =
    await Promise.all([getBalanceFlows(to), getRates(), getProfile()]);
  const currency = code(profile.baseCurrency);
  const { granularity, buckets } = bucketsFor(from, to);
  const points = buckets
    .filter((b) => b.start <= day)
    .map((b) => ({ ...b, at: b.end < day ? b.end : day }));
  // Gold is worth its quantity at the latest price, not its transactions.
  const isGold = new Set(
    accountList.filter((a) => a.type === "gold").map((a) => a.id),
  );
  const balances = balancesAt(
    accountList.map((a) =>
      isGold.has(a.id)
        ? {
            ...a,
            openingBalance: goldValue(a.goldQuantity ?? 0, a.unitPrice ?? 0),
          }
        : a,
    ),
    flows.filter((f) => !isGold.has(f.accountId)),
    points.map((p) => p.at),
  );
  const sums = converter(currency, rateInfo.rates);
  const values = points.map((point, i) => {
    let total = 0;
    let exists = false;
    for (const account of accountList) {
      const balance = balances.get(account.id)?.[i];
      if (balance === null || balance === undefined) continue;
      exists = true;
      total += sums.add(balance, account.currency);
    }
    return { ...point, value: exists ? total : null };
  });
  return {
    granularity,
    points: values,
    currency,
    missing: sums.state.missing,
    rateInfo,
  };
}

/**
 * Typical monthly income, expenses and savings: averages over the last three
 * complete months that had any activity. Null without data.
 */
export const getMonthlyAverages = cache(async () => {
  const month = monthOf(today());
  const from = addMonths(month, -3);
  const to = periodRange("lastMonth", today()).to;
  const flow = await getCashFlow(from, to);
  const active = flow.rows.filter((r) => r.income > 0 || r.expense > 0);
  if (active.length === 0) return null;
  const average = (pick: (r: (typeof active)[number]) => number) =>
    Math.round(active.reduce((sum, r) => sum + pick(r), 0) / active.length);
  return {
    income: average((r) => r.income),
    expense: average((r) => r.expense),
    saving: average((r) => r.income - r.expense),
    months: active.length,
  };
});

/** Balances of the given accounts at the end of `day`, in their currencies. */
export async function getBalancesOn(day: string) {
  const { flows, accounts: list } = await getBalanceFlows(today());
  const balances = balancesAt(list, flows, [day]);
  return new Map([...balances].map(([id, [value]]) => [id, value ?? null]));
}
