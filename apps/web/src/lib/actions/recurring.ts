"use server";

import {
  type CurrencyCode,
  fieldErrors,
  firstOccurrenceAfter,
  isCurrencyCode,
  type Locale,
  occurrenceDate,
  parseAmount,
  recurringSchema,
  type Schedule,
  type ValidationError,
} from "@projectb/core";
import {
  accounts,
  categories,
  recurringRules,
  transactions,
} from "@projectb/db";
import { eq, max } from "drizzle-orm";
import { redirect } from "next/navigation";
import { withUser } from "@/lib/auth";
import { materializeRecurring } from "@/lib/data/recurring";
import { today } from "@/lib/dates";
import { type FormState, respond } from "./state";

const values = (formData: FormData) =>
  Object.fromEntries(
    [...formData.entries()].filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );

const dayBefore = (day: string) =>
  new Date(Date.parse(`${day}T00:00:00Z`) - 86_400_000)
    .toISOString()
    .slice(0, 10);

/** Where a schedule continues once everything up to `after` is behind it. */
function position(schedule: Schedule, after: string) {
  const k = firstOccurrenceAfter(schedule, after);
  return k === null
    ? { occurrences: 0, nextOn: schedule.startOn, finished: true }
    : { occurrences: k, nextOn: occurrenceDate(schedule, k), finished: false };
}

async function saveRule(
  locale: Locale,
  ruleId: string | null,
  formData: FormData,
): Promise<FormState> {
  const submitted = values(formData);
  const parsed = recurringSchema.safeParse(submitted);
  if (!parsed.success) {
    return {
      status: "error",
      fieldErrors: fieldErrors(parsed.error),
      values: submitted,
    };
  }
  const data = parsed.data;
  const isTransfer = data.kind === "transfer";
  const fail = (field: string, error: ValidationError): FormState => ({
    status: "error",
    fieldErrors: { [field]: error },
    values: submitted,
  });

  const result = await withUser(async (tx): Promise<FormState | null> => {
    const currencyOf = async (
      id: string | null,
    ): Promise<CurrencyCode | null> => {
      if (!id) return null;
      const [row] = await tx
        .select({ c: accounts.currency })
        .from(accounts)
        .where(eq(accounts.id, id));
      return row && isCurrencyCode(row.c) ? row.c : null;
    };
    const currency = await currencyOf(data.accountId);
    if (!currency) return fail("accountId", "invalidAccount");
    const toCurrency = isTransfer ? await currencyOf(data.toAccountId) : null;
    if (isTransfer && !toCurrency) return fail("toAccountId", "invalidAccount");

    const amount = parseAmount(data.amount, currency, locale);
    if ("error" in amount) return fail("amount", amount.error);
    let toAmount: number | null = null;
    if (isTransfer) {
      if (toCurrency === currency) toAmount = amount.amount;
      else if (!data.toAmount.trim()) return fail("toAmount", "amountRequired");
      else {
        const parsedTo = parseAmount(data.toAmount, toCurrency!, locale);
        if ("error" in parsedTo) return fail("toAmount", parsedTo.error);
        toAmount = parsedTo.amount;
      }
    }

    const categoryId = isTransfer ? null : data.categoryId;
    if (categoryId) {
      const [category] = await tx
        .select({ kind: categories.kind })
        .from(categories)
        .where(eq(categories.id, categoryId));
      if (category?.kind !== data.kind)
        return fail("categoryId", "invalidCategory");
    }

    const schedule: Schedule = {
      startOn: data.startOn,
      frequency: data.frequency,
      interval: data.interval,
      endOn: data.endOn,
      maxOccurrences: data.maxOccurrences,
    };
    // Continue after the newest transaction this rule already created, so
    // editing the schedule never creates the same period twice.
    let after = dayBefore(data.startOn);
    if (ruleId) {
      const [last] = await tx
        .select({ on: max(transactions.occurredOn) })
        .from(transactions)
        .where(eq(transactions.recurringRuleId, ruleId));
      if (last?.on && last.on > after) after = last.on;
    }
    const row = {
      kind: data.kind,
      accountId: data.accountId,
      toAccountId: isTransfer ? data.toAccountId : null,
      amount: amount.amount,
      toAmount,
      categoryId,
      note: data.note,
      tagNames: data.tags,
      startOn: data.startOn,
      frequency: data.frequency,
      intervalCount: data.interval,
      endOn: data.endOn,
      maxOccurrences: data.maxOccurrences,
      ...position(schedule, after),
    };
    if (ruleId) {
      const updated = await tx
        .update(recurringRules)
        .set(row)
        .where(eq(recurringRules.id, ruleId))
        .returning({ id: recurringRules.id });
      if (updated.length === 0) return { status: "error", error: "unknown" };
    } else {
      await tx.insert(recurringRules).values(row);
    }
    return null;
  });

  if (result) return result;
  await materializeRecurring(true);
  redirect(`/${locale}/recurring`);
}

export async function saveRecurring(
  locale: Locale,
  ruleId: string | null,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  return respond(await saveRule(locale, ruleId, formData));
}

/** Pausing stops new transactions; resuming skips the dates missed meanwhile. */
export async function setRecurringPaused(
  locale: Locale,
  ruleId: string,
  paused: boolean,
) {
  await withUser(async (tx) => {
    const [rule] = await tx
      .select()
      .from(recurringRules)
      .where(eq(recurringRules.id, ruleId));
    if (!rule) return;
    const resume = paused
      ? {}
      : position(
          {
            startOn: rule.startOn,
            frequency: rule.frequency as Schedule["frequency"],
            interval: rule.intervalCount,
            endOn: rule.endOn,
            maxOccurrences: rule.maxOccurrences,
          },
          dayBefore(today()),
        );
    await tx
      .update(recurringRules)
      .set({ paused, ...resume })
      .where(eq(recurringRules.id, ruleId));
  });
  await materializeRecurring(true);
  redirect(`/${locale}/recurring`);
}

export async function deleteRecurring(locale: Locale, ruleId: string) {
  await withUser((tx) =>
    tx.delete(recurringRules).where(eq(recurringRules.id, ruleId)),
  );
  redirect(`/${locale}/recurring`);
}
