import {
  CURRENCIES,
  DEFAULT_CURRENCY,
  DEFAULT_LOCALE,
  LOCALES,
} from "@projectb/core";
import { sql } from "drizzle-orm";
import {
  check,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { authenticatedRole, authUid, authUsers } from "drizzle-orm/supabase";

const list = (values: readonly string[]) =>
  sql.raw(values.map((v) => `'${v}'`).join(", "));

/** One row per user, created by a trigger when the user signs up. */
export const profiles = pgTable(
  "profiles",
  {
    id: uuid()
      .primaryKey()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    displayName: text("display_name"),
    locale: text().notNull().default(DEFAULT_LOCALE),
    baseCurrency: text("base_currency").notNull().default(DEFAULT_CURRENCY),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    check("profiles_locale_check", sql`${t.locale} in (${list(LOCALES)})`),
    check(
      "profiles_base_currency_check",
      sql`${t.baseCurrency} in (${list(Object.keys(CURRENCIES))})`,
    ),
    pgPolicy("profiles_select_own", {
      for: "select",
      to: authenticatedRole,
      using: sql`${t.id} = ${authUid}`,
    }),
    pgPolicy("profiles_update_own", {
      for: "update",
      to: authenticatedRole,
      using: sql`${t.id} = ${authUid}`,
      withCheck: sql`${t.id} = ${authUid}`,
    }),
  ],
).enableRLS();

export type Profile = typeof profiles.$inferSelect;
