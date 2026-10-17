import "server-only";
import {
  accountBalances,
  accounts,
  categories,
  expenseEntries,
  tags,
  transactions,
  transactionTags,
} from "@projectb/db";
import {
  and,
  asc,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  lte,
  or,
  type SQL,
  sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { cache } from "react";
import { withUser } from "@/lib/auth";
import { materializeRecurring } from "./recurring";

export const getAccounts = cache(async () => {
  await materializeRecurring();
  return withUser((tx) =>
    tx
      .select({
        id: accounts.id,
        name: accounts.name,
        type: accounts.type,
        currency: accounts.currency,
        openingBalance: accounts.openingBalance,
        creditLimit: accounts.creditLimit,
        statementDay: accounts.statementDay,
        dueDay: accounts.dueDay,
        minPaymentRate: accounts.minPaymentRate,
        archivedAt: accounts.archivedAt,
        balance: accountBalances.balance,
      })
      .from(accounts)
      .innerJoin(accountBalances, eq(accountBalances.accountId, accounts.id))
      .orderBy(asc(accounts.createdAt)),
  );
});

export type AccountWithBalance = Awaited<
  ReturnType<typeof getAccounts>
>[number];

export async function getAccount(id: string) {
  return (await getAccounts()).find((a) => a.id === id) ?? null;
}

export const getCategories = cache(async () =>
  withUser((tx) =>
    tx
      .select({
        id: categories.id,
        kind: categories.kind,
        parentId: categories.parentId,
        systemKey: categories.systemKey,
        name: categories.name,
        archivedAt: categories.archivedAt,
      })
      .from(categories)
      .orderBy(asc(categories.sortOrder), asc(categories.createdAt)),
  ),
);

export type CategoryRow = Awaited<ReturnType<typeof getCategories>>[number];

export const getTags = cache(async () =>
  withUser((tx) =>
    tx
      .select({ id: tags.id, name: tags.name })
      .from(tags)
      .orderBy(sql`lower(${tags.name})`),
  ),
);

export type TransactionFilters = {
  q?: string;
  kind?: string;
  accountId?: string;
  categoryId?: string;
  tagId?: string;
  from?: string;
  to?: string;
  minAmount?: number;
  maxAmount?: number;
};

export const PAGE_SIZE = 50;

const toAccounts = alias(accounts, "to_accounts");

/**
 * Tag names of each transaction. The outer id is written out in full because
 * Drizzle leaves columns unqualified in single-table queries, where a bare
 * "id" would bind to tags.id inside the subquery.
 */
const outerTransactionId = sql`${sql.identifier("transactions")}.${sql.identifier("id")}`;
const tagNames = sql<string[]>`coalesce((
  select array_agg(${tags.name} order by lower(${tags.name}))
  from ${transactionTags} join ${tags} on ${tags.id} = ${transactionTags.tagId}
  where ${transactionTags.transactionId} = ${outerTransactionId}
), '{}')`;

export async function listTransactions(filters: TransactionFilters, page = 1) {
  const conditions: (SQL | undefined)[] = [];
  if (filters.kind) conditions.push(eq(transactions.kind, filters.kind));
  if (filters.accountId) {
    conditions.push(
      or(
        eq(transactions.accountId, filters.accountId),
        eq(transactions.toAccountId, filters.accountId),
      ),
    );
  }
  if (filters.categoryId) {
    // A parent category also matches its subcategories.
    conditions.push(
      or(
        eq(transactions.categoryId, filters.categoryId),
        inArray(
          transactions.categoryId,
          sql`(select ${categories.id} from ${categories} where ${categories.parentId} = ${filters.categoryId})`,
        ),
      ),
    );
  }
  if (filters.tagId) {
    conditions.push(
      sql`exists (select 1 from ${transactionTags} where ${transactionTags.transactionId} = ${outerTransactionId} and ${transactionTags.tagId} = ${filters.tagId})`,
    );
  }
  if (filters.from) conditions.push(gte(transactions.occurredOn, filters.from));
  if (filters.to) conditions.push(lte(transactions.occurredOn, filters.to));
  if (filters.minAmount !== undefined)
    conditions.push(gte(transactions.amount, filters.minAmount));
  if (filters.maxAmount !== undefined)
    conditions.push(lte(transactions.amount, filters.maxAmount));
  if (filters.q) {
    const pattern = `%${filters.q.replace(/[\\%_]/g, "\\$&")}%`;
    conditions.push(
      or(
        ilike(transactions.note, pattern),
        sql`exists (select 1 from ${transactionTags} join ${tags} on ${tags.id} = ${transactionTags.tagId} where ${transactionTags.transactionId} = ${outerTransactionId} and ${tags.name} ilike ${pattern})`,
      ),
    );
  }

  await materializeRecurring();
  const rows = await withUser((tx) =>
    tx
      .select({
        id: transactions.id,
        kind: transactions.kind,
        amount: transactions.amount,
        toAmount: transactions.toAmount,
        occurredOn: transactions.occurredOn,
        installmentCount: transactions.installmentCount,
        recurringRuleId: transactions.recurringRuleId,
        note: transactions.note,
        categoryId: transactions.categoryId,
        account: {
          id: accounts.id,
          name: accounts.name,
          currency: accounts.currency,
        },
        toAccount: {
          id: toAccounts.id,
          name: toAccounts.name,
          currency: toAccounts.currency,
        },
        tags: tagNames,
      })
      .from(transactions)
      .innerJoin(accounts, eq(accounts.id, transactions.accountId))
      .leftJoin(toAccounts, eq(toAccounts.id, transactions.toAccountId))
      .where(and(...conditions))
      .orderBy(desc(transactions.occurredOn), desc(transactions.createdAt))
      .limit(PAGE_SIZE + 1)
      .offset((page - 1) * PAGE_SIZE),
  );

  return { rows: rows.slice(0, PAGE_SIZE), hasMore: rows.length > PAGE_SIZE };
}

export type TransactionListRow = Awaited<
  ReturnType<typeof listTransactions>
>["rows"][number];

export async function getTransaction(id: string) {
  const [row] = await withUser((tx) =>
    tx
      .select({
        id: transactions.id,
        kind: transactions.kind,
        accountId: transactions.accountId,
        toAccountId: transactions.toAccountId,
        categoryId: transactions.categoryId,
        amount: transactions.amount,
        toAmount: transactions.toAmount,
        occurredOn: transactions.occurredOn,
        installmentCount: transactions.installmentCount,
        note: transactions.note,
        tags: tagNames,
      })
      .from(transactions)
      .where(eq(transactions.id, id)),
  );
  return row ?? null;
}

/**
 * Income and expenses between two dates, per account currency. Installment
 * purchases count with the installments that fall in the period.
 */
export async function getTotals(from: string, to: string) {
  await materializeRecurring();
  return withUser(async (tx) => {
    const [income, expense] = await Promise.all([
      tx
        .select({
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
        .groupBy(accounts.currency),
      tx
        .select({
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
        .groupBy(accounts.currency),
    ]);
    return [
      ...income.map((row) => ({ ...row, kind: "income" as const })),
      ...expense.map((row) => ({ ...row, kind: "expense" as const })),
    ];
  });
}

/** Every transaction that moves money on or off a card, oldest first. */
export async function getCardTransactions(cardId: string) {
  await materializeRecurring();
  return withUser((tx) =>
    tx
      .select({
        id: transactions.id,
        kind: transactions.kind,
        accountId: transactions.accountId,
        toAccountId: transactions.toAccountId,
        amount: transactions.amount,
        toAmount: transactions.toAmount,
        occurredOn: transactions.occurredOn,
        installmentCount: transactions.installmentCount,
        note: transactions.note,
        categoryId: transactions.categoryId,
      })
      .from(transactions)
      .where(
        or(
          eq(transactions.accountId, cardId),
          eq(transactions.toAccountId, cardId),
        ),
      )
      .orderBy(asc(transactions.occurredOn), asc(transactions.createdAt)),
  );
}

export async function countAccountTransactions(accountId: string) {
  const [row] = await withUser((tx) =>
    tx
      .select({ count: sql<number>`count(*)::int` })
      .from(transactions)
      .where(
        or(
          eq(transactions.accountId, accountId),
          eq(transactions.toAccountId, accountId),
        ),
      ),
  );
  return row?.count ?? 0;
}
