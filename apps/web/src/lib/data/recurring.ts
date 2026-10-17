import "server-only";
import { recurringRules } from "@projectb/db";
import { asc, sql } from "drizzle-orm";
import { cache } from "react";
import { requireClaims, withUser } from "@/lib/auth";
import { today } from "@/lib/dates";

/** User id → the day their due recurring transactions were last created. */
const materializedOn = new Map<string, string>();

/**
 * Creates the signed-in user's due recurring transactions. Runs at most once
 * per user and day on this server (and once per request), so pages do not pay
 * for it on every load; actions that change rules call it with `force`.
 */
export const materializeRecurring = cache(async (force = false) => {
  const claims = await requireClaims();
  const day = today();
  if (!force && materializedOn.get(claims.sub) === day) return;
  await withUser((tx) =>
    tx.execute(sql`select public.materialize_recurring(${day}::date)`),
  );
  materializedOn.set(claims.sub, day);
});

export const getRecurringRules = cache(async () => {
  await materializeRecurring();
  return withUser((tx) =>
    tx
      .select()
      .from(recurringRules)
      .orderBy(asc(recurringRules.nextOn), asc(recurringRules.createdAt)),
  );
});
