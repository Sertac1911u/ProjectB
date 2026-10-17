import { CURRENCIES } from "@projectb/core";
import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  date,
  foreignKey,
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { categories } from "./finance";
import { inList, ownerId, ownRowsPolicy, timestamps } from "./helpers";

const amount = (name: string) => bigint(name, { mode: "number" });
const currencyCodes = inList(Object.keys(CURRENCIES));

/**
 * Monthly spending limit of an expense category. A row applies from its month
 * until the category's next row; a row without an amount removes the budget
 * from that month on. Past months keep the limits they had.
 */
export const budgets = pgTable(
  "budgets",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: ownerId(),
    categoryId: uuid("category_id").notNull(),
    /** First day of the month the limit applies from. */
    month: date().notNull(),
    amount: amount("amount"),
    currency: text().notNull(),
    ...timestamps(),
  },
  (t) => [
    unique("budgets_user_id_category_id_month_key").on(
      t.userId,
      t.categoryId,
      t.month,
    ),
    index("budgets_category_id_idx").on(t.categoryId),
    foreignKey({
      name: "budgets_category_fk",
      columns: [t.categoryId, t.userId],
      foreignColumns: [categories.id, categories.userId],
    }).onDelete("cascade"),
    check("budgets_month_check", sql`extract(day from ${t.month}) = 1`),
    check("budgets_amount_check", sql`${t.amount} > 0`),
    check("budgets_currency_check", sql`${t.currency} in (${currencyCodes})`),
    ownRowsPolicy("budgets", t.userId),
  ],
).enableRLS();

export const goals = pgTable(
  "goals",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: ownerId(),
    name: text().notNull(),
    targetAmount: amount("target_amount").notNull(),
    currency: text().notNull(),
    targetDate: date("target_date"),
    /**
     * When set, progress is this account's balance. Its foreign key is in
     * migration 0011 because it uses ON DELETE SET NULL (column): deleting the
     * account turns the goal into one tracked by contributions.
     */
    accountId: uuid("account_id"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    unique("goals_id_user_id_key").on(t.id, t.userId),
    index("goals_user_id_idx").on(t.userId),
    index("goals_account_id_idx").on(t.accountId),
    check("goals_name_check", sql`char_length(${t.name}) between 1 and 60`),
    check("goals_target_amount_check", sql`${t.targetAmount} > 0`),
    check("goals_currency_check", sql`${t.currency} in (${currencyCodes})`),
    ownRowsPolicy("goals", t.userId),
  ],
).enableRLS();

/** Money put towards (or taken back from) a goal not linked to an account. */
export const goalContributions = pgTable(
  "goal_contributions",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: ownerId(),
    goalId: uuid("goal_id").notNull(),
    /** In the goal's currency; negative for withdrawals. */
    amount: amount("amount").notNull(),
    occurredOn: date("occurred_on").notNull(),
    note: text(),
    ...timestamps(),
  },
  (t) => [
    index("goal_contributions_goal_id_idx").on(t.goalId),
    foreignKey({
      name: "goal_contributions_goal_fk",
      columns: [t.goalId, t.userId],
      foreignColumns: [goals.id, goals.userId],
    }).onDelete("cascade"),
    check("goal_contributions_amount_check", sql`${t.amount} <> 0`),
    check("goal_contributions_note_check", sql`char_length(${t.note}) <= 200`),
    ownRowsPolicy("goal_contributions", t.userId),
  ],
).enableRLS();

export type Budget = typeof budgets.$inferSelect;
export type Goal = typeof goals.$inferSelect;
export type GoalContribution = typeof goalContributions.$inferSelect;
