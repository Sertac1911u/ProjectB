import {
  ACCOUNT_TYPES,
  GOLD_UNITS,
  CATEGORY_KINDS,
  CURRENCIES,
  FREQUENCIES,
  MAX_INSTALLMENTS,
  MAX_INTERVAL,
  MAX_OCCURRENCES,
  TRANSACTION_KINDS,
} from "@projectb/core";
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  pgTable,
  pgView,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { inList, ownerId, ownRowsPolicy, timestamps } from "./helpers";

// Every table carries user_id, and references to other tables include it in a
// composite foreign key, so a row can never point at another user's data.

const amount = (name: string) => bigint(name, { mode: "number" });

export const accounts = pgTable(
  "accounts",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: ownerId(),
    name: text().notNull(),
    type: text().notNull(),
    currency: text().notNull(),
    /** Counted as money available to spend in the cash flow forecast. */
    spendable: boolean().notNull().default(true),
    /** Balance before the first recorded transaction, in minor units. */
    openingBalance: amount("opening_balance").notNull().default(0),
    // Credit cards only; null until the user enters the card's settings.
    creditLimit: amount("credit_limit"),
    statementDay: smallint("statement_day"),
    dueDay: smallint("due_day"),
    /** Minimum payment as a percentage of the statement amount. */
    minPaymentRate: smallint("min_payment_rate"),
    /** Cards and loans: monthly interest in hundredths of a percent (349 = 3,49%). */
    interestRateBp: smallint("interest_rate_bp"),
    /** Loans only: the monthly installment. */
    loanPayment: amount("loan_payment"),
    // Gold only: worth quantity × unit price, whatever the transactions say.
    goldUnit: text("gold_unit"),
    /** In thousandths of the unit: 12,5 gram is 12500. */
    goldQuantity: bigint("gold_quantity", { mode: "number" }),
    unitPrice: amount("unit_price"),
    /** When the unit price was last updated. */
    priceOn: date("price_on"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    unique("accounts_id_user_id_key").on(t.id, t.userId),
    index("accounts_user_id_idx").on(t.userId),
    check("accounts_name_check", sql`char_length(${t.name}) between 1 and 60`),
    check("accounts_type_check", sql`${t.type} in (${inList(ACCOUNT_TYPES)})`),
    check(
      "accounts_currency_check",
      sql`${t.currency} in (${inList(Object.keys(CURRENCIES))})`,
    ),
    check(
      "accounts_card_settings_check",
      sql`${t.type} = 'credit_card' or (${t.creditLimit} is null and ${t.statementDay} is null
        and ${t.dueDay} is null and ${t.minPaymentRate} is null)`,
    ),
    check("accounts_credit_limit_check", sql`${t.creditLimit} >= 0`),
    check(
      "accounts_statement_day_check",
      sql`${t.statementDay} between 1 and 31`,
    ),
    check("accounts_due_day_check", sql`${t.dueDay} between 1 and 31`),
    check(
      "accounts_min_payment_rate_check",
      sql`${t.minPaymentRate} between 0 and 100`,
    ),
    check(
      "accounts_interest_rate_check",
      sql`${t.interestRateBp} is null or (${t.type} in ('credit_card', 'loan')
        and ${t.interestRateBp} between 0 and 10000)`,
    ),
    check(
      "accounts_loan_check",
      sql`${t.loanPayment} is null or (${t.type} = 'loan' and ${t.loanPayment} > 0)`,
    ),
    check(
      "accounts_gold_check",
      sql`case when ${t.type} = 'gold'
        then ${t.goldUnit} in (${inList(GOLD_UNITS)}) and ${t.goldQuantity} >= 0
          and ${t.unitPrice} > 0 and ${t.priceOn} is not null
        else ${t.goldUnit} is null and ${t.goldQuantity} is null
          and ${t.unitPrice} is null and ${t.priceOn} is null end`,
    ),
    ownRowsPolicy("accounts", t.userId),
  ],
).enableRLS();

export const categories = pgTable(
  "categories",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: ownerId(),
    kind: text().notNull(),
    parentId: uuid("parent_id"),
    /** Set for the default categories; their names are translated in the UI. */
    systemKey: text("system_key"),
    /** Custom name; overrides the translated default name when set. */
    name: text(),
    sortOrder: integer("sort_order").notNull().default(1000),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    unique("categories_id_user_id_key").on(t.id, t.userId),
    uniqueIndex("categories_user_id_system_key_idx")
      .on(t.userId, t.systemKey)
      .where(sql`${t.systemKey} is not null`),
    index("categories_user_id_idx").on(t.userId),
    foreignKey({
      name: "categories_parent_fk",
      columns: [t.parentId, t.userId],
      foreignColumns: [t.id, t.userId],
    }).onDelete("cascade"),
    check(
      "categories_kind_check",
      sql`${t.kind} in (${inList(CATEGORY_KINDS)})`,
    ),
    check(
      "categories_name_check",
      sql`coalesce(char_length(${t.name}) between 1 and 40, ${t.systemKey} is not null)`,
    ),
    check("categories_not_own_parent_check", sql`${t.parentId} <> ${t.id}`),
    ownRowsPolicy("categories", t.userId),
  ],
).enableRLS();

export const transactions = pgTable(
  "transactions",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: ownerId(),
    kind: text().notNull(),
    accountId: uuid("account_id").notNull(),
    /** Always positive, in the account's minor units; `kind` gives the direction. */
    amount: amount("amount").notNull(),
    categoryId: uuid("category_id"),
    /** Transfers only: the receiving account and the amount it receives. */
    toAccountId: uuid("to_account_id"),
    toAmount: amount("to_amount"),
    occurredOn: date("occurred_on").notNull(),
    /** Expenses only: paid in this many monthly installments (1 = at once). */
    installmentCount: smallint("installment_count").notNull().default(1),
    /**
     * The recurring rule that created this transaction. Its foreign key is in
     * migration 0009 because it uses ON DELETE SET NULL (column), which
     * Drizzle cannot express: deleting a rule keeps its past transactions.
     */
    recurringRuleId: uuid("recurring_rule_id"),
    note: text(),
    ...timestamps(),
  },
  (t) => [
    unique("transactions_id_user_id_key").on(t.id, t.userId),
    index("transactions_user_id_occurred_on_idx").on(
      t.userId,
      t.occurredOn.desc(),
    ),
    index("transactions_account_id_idx").on(t.accountId),
    index("transactions_to_account_id_idx").on(t.toAccountId),
    index("transactions_category_id_idx").on(t.categoryId),
    // A rule creates at most one transaction per day it falls on.
    uniqueIndex("transactions_recurring_rule_id_occurred_on_idx")
      .on(t.recurringRuleId, t.occurredOn)
      .where(sql`${t.recurringRuleId} is not null`),
    foreignKey({
      name: "transactions_account_fk",
      columns: [t.accountId, t.userId],
      foreignColumns: [accounts.id, accounts.userId],
    }).onDelete("cascade"),
    foreignKey({
      name: "transactions_to_account_fk",
      columns: [t.toAccountId, t.userId],
      foreignColumns: [accounts.id, accounts.userId],
    }).onDelete("cascade"),
    foreignKey({
      name: "transactions_category_fk",
      columns: [t.categoryId, t.userId],
      foreignColumns: [categories.id, categories.userId],
    }),
    check(
      "transactions_kind_check",
      sql`${t.kind} in (${inList(TRANSACTION_KINDS)})`,
    ),
    check("transactions_amount_check", sql`${t.amount} > 0`),
    check(
      "transactions_transfer_check",
      sql`case when ${t.kind} = 'transfer'
        then ${t.toAccountId} is not null and ${t.toAccountId} <> ${t.accountId}
          and ${t.toAmount} is not null and ${t.toAmount} > 0 and ${t.categoryId} is null
        else ${t.toAccountId} is null and ${t.toAmount} is null end`,
    ),
    check("transactions_note_check", sql`char_length(${t.note}) <= 500`),
    check(
      "transactions_installment_count_check",
      sql`${t.installmentCount} between 1 and ${sql.raw(String(MAX_INSTALLMENTS))}
        and (${t.installmentCount} = 1 or ${t.kind} = 'expense')`,
    ),
    ownRowsPolicy("transactions", t.userId),
  ],
).enableRLS();

export const tags = pgTable(
  "tags",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: ownerId(),
    name: text().notNull(),
    ...timestamps(),
  },
  (t) => [
    unique("tags_id_user_id_key").on(t.id, t.userId),
    uniqueIndex("tags_user_id_name_idx").on(t.userId, sql`lower(${t.name})`),
    check("tags_name_check", sql`char_length(${t.name}) between 1 and 30`),
    ownRowsPolicy("tags", t.userId),
  ],
).enableRLS();

export const transactionTags = pgTable(
  "transaction_tags",
  {
    transactionId: uuid("transaction_id").notNull(),
    tagId: uuid("tag_id").notNull(),
    userId: ownerId(),
  },
  (t) => [
    primaryKey({ columns: [t.transactionId, t.tagId] }),
    index("transaction_tags_tag_id_idx").on(t.tagId),
    foreignKey({
      name: "transaction_tags_transaction_fk",
      columns: [t.transactionId, t.userId],
      foreignColumns: [transactions.id, transactions.userId],
    }).onDelete("cascade"),
    foreignKey({
      name: "transaction_tags_tag_fk",
      columns: [t.tagId, t.userId],
      foreignColumns: [tags.id, tags.userId],
    }).onDelete("cascade"),
    ownRowsPolicy("transaction_tags", t.userId),
  ],
).enableRLS();

export const recurringRules = pgTable(
  "recurring_rules",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: ownerId(),
    kind: text().notNull(),
    accountId: uuid("account_id").notNull(),
    toAccountId: uuid("to_account_id"),
    amount: amount("amount").notNull(),
    toAmount: amount("to_amount"),
    categoryId: uuid("category_id"),
    note: text(),
    tagNames: text("tag_names")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    startOn: date("start_on").notNull(),
    frequency: text().notNull(),
    intervalCount: smallint("interval_count").notNull().default(1),
    endOn: date("end_on"),
    maxOccurrences: smallint("max_occurrences"),
    /** How many occurrences are behind us: the index of the next one. */
    occurrences: integer().notNull().default(0),
    /** Date of the next occurrence to create. */
    nextOn: date("next_on").notNull(),
    paused: boolean().notNull().default(false),
    /** Set once the schedule has no occurrences left. */
    finished: boolean().notNull().default(false),
    ...timestamps(),
  },
  (t) => [
    unique("recurring_rules_id_user_id_key").on(t.id, t.userId),
    index("recurring_rules_user_id_next_on_idx").on(t.userId, t.nextOn),
    foreignKey({
      name: "recurring_rules_account_fk",
      columns: [t.accountId, t.userId],
      foreignColumns: [accounts.id, accounts.userId],
    }).onDelete("cascade"),
    foreignKey({
      name: "recurring_rules_to_account_fk",
      columns: [t.toAccountId, t.userId],
      foreignColumns: [accounts.id, accounts.userId],
    }).onDelete("cascade"),
    foreignKey({
      name: "recurring_rules_category_fk",
      columns: [t.categoryId, t.userId],
      foreignColumns: [categories.id, categories.userId],
    }),
    check(
      "recurring_rules_kind_check",
      sql`${t.kind} in (${inList(TRANSACTION_KINDS)})`,
    ),
    check("recurring_rules_amount_check", sql`${t.amount} > 0`),
    check(
      "recurring_rules_transfer_check",
      sql`case when ${t.kind} = 'transfer'
        then ${t.toAccountId} is not null and ${t.toAccountId} <> ${t.accountId}
          and ${t.toAmount} is not null and ${t.toAmount} > 0 and ${t.categoryId} is null
        else ${t.toAccountId} is null and ${t.toAmount} is null end`,
    ),
    check(
      "recurring_rules_frequency_check",
      sql`${t.frequency} in (${inList(FREQUENCIES)})`,
    ),
    check(
      "recurring_rules_interval_check",
      sql`${t.intervalCount} between 1 and ${sql.raw(String(MAX_INTERVAL))}`,
    ),
    check(
      "recurring_rules_max_occurrences_check",
      sql`${t.maxOccurrences} between 1 and ${sql.raw(String(MAX_OCCURRENCES))}`,
    ),
    check("recurring_rules_end_on_check", sql`${t.endOn} >= ${t.startOn}`),
    check("recurring_rules_note_check", sql`char_length(${t.note}) <= 500`),
    ownRowsPolicy("recurring_rules", t.userId),
  ],
).enableRLS();

/**
 * Current balance per account. Created in migration 0004 with
 * security_invoker, so row level security of the underlying tables applies.
 */
export const accountBalances = pgView("account_balances", {
  accountId: uuid("account_id").notNull(),
  userId: uuid("user_id").notNull(),
  balance: amount("balance").notNull(),
}).existing();

/**
 * Expenses spread over the months they are paid in: an installment purchase
 * yields one row per installment, a regular expense one row. Created in
 * migration 0006 with security_invoker. Budgets and reports use this.
 */
export const expenseEntries = pgView("expense_entries", {
  transactionId: uuid("transaction_id").notNull(),
  userId: uuid("user_id").notNull(),
  accountId: uuid("account_id").notNull(),
  categoryId: uuid("category_id"),
  entryOn: date("entry_on").notNull(),
  amount: amount("amount").notNull(),
  installmentNumber: integer("installment_number").notNull(),
  installmentCount: smallint("installment_count").notNull(),
}).existing();

export type Account = typeof accounts.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type Tag = typeof tags.$inferSelect;
export type RecurringRule = typeof recurringRules.$inferSelect;
