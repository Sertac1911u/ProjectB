import { CURRENCIES, MAX_ENVELOPE_INTERVAL } from "@projectb/core";
import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  date,
  index,
  pgTable,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { inList, ownerId, ownRowsPolicy, timestamps } from "./helpers";

/**
 * Money set aside for a rare, known payment (insurance, taxes, a holiday).
 * The share saved up so far is worked out from the dates, so nothing has to
 * be moved between accounts.
 */
export const envelopes = pgTable(
  "envelopes",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: ownerId(),
    name: text().notNull(),
    amount: bigint({ mode: "number" }).notNull(),
    currency: text().notNull(),
    /** When saving for the payment at `dueOn` started. */
    startOn: date("start_on").notNull(),
    dueOn: date("due_on").notNull(),
    /** Months between payments, or null for a one-time payment. */
    intervalMonths: smallint("interval_months"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    index("envelopes_user_id_idx").on(t.userId),
    check("envelopes_name_check", sql`char_length(${t.name}) between 1 and 60`),
    check("envelopes_amount_check", sql`${t.amount} > 0`),
    check(
      "envelopes_currency_check",
      sql`${t.currency} in (${inList(Object.keys(CURRENCIES))})`,
    ),
    check("envelopes_dates_check", sql`${t.dueOn} >= ${t.startOn}`),
    check(
      "envelopes_interval_check",
      sql`${t.intervalMonths} between 1 and ${sql.raw(String(MAX_ENVELOPE_INTERVAL))}`,
    ),
    ownRowsPolicy("envelopes", t.userId),
  ],
).enableRLS();

export type EnvelopeRow = typeof envelopes.$inferSelect;
