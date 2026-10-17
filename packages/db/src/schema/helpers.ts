import { sql } from "drizzle-orm";
import { pgPolicy, timestamp, uuid } from "drizzle-orm/pg-core";
import { authenticatedRole, authUid, authUsers } from "drizzle-orm/supabase";

export const inList = (values: readonly string[]) =>
  sql.raw(values.map((v) => `'${v}'`).join(", "));

/** Owner column: filled in from the signed-in user unless given explicitly. */
export const ownerId = () =>
  uuid("user_id")
    .notNull()
    .default(sql`auth.uid()`)
    .references(() => authUsers.id, { onDelete: "cascade" });

export const timestamps = () => ({
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

/** Lets signed-in users read and change only the rows they own. */
export const ownRowsPolicy = (table: string, userId: { name: string }) =>
  pgPolicy(`${table}_own_rows`, {
    for: "all",
    to: authenticatedRole,
    using: sql`${sql.identifier(userId.name)} = ${authUid}`,
    withCheck: sql`${sql.identifier(userId.name)} = ${authUid}`,
  });
