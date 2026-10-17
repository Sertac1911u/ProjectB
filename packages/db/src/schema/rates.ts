import { sql } from "drizzle-orm";
import {
  check,
  date,
  numeric,
  pgPolicy,
  pgTable,
  primaryKey,
  text,
} from "drizzle-orm/pg-core";
import { authenticatedRole } from "drizzle-orm/supabase";

/**
 * Daily TCMB exchange rates, shared by all users: Turkish lira per one unit
 * of `currency` on `rateOn`. Signed-in users may read them; only the server
 * (connecting as the table owner) writes them.
 */
export const exchangeRates = pgTable(
  "exchange_rates",
  {
    rateOn: date("rate_on").notNull(),
    currency: text().notNull(),
    tryPerUnit: numeric("try_per_unit", {
      precision: 20,
      scale: 8,
      mode: "number",
    }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.rateOn, t.currency] }),
    check("exchange_rates_positive_check", sql`${t.tryPerUnit} > 0`),
    pgPolicy("exchange_rates_read", {
      for: "select",
      to: authenticatedRole,
      using: sql`true`,
    }),
  ],
).enableRLS();
