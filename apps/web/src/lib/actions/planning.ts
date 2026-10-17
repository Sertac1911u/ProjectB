"use server";

import {
  budgetSchema,
  contributionSchema,
  DEFAULT_CURRENCY,
  fieldErrors,
  goalSchema,
  isCurrencyCode,
  type Locale,
  parseAmount,
  type ValidationError,
} from "@projectb/core";
import {
  accounts,
  budgets,
  categories,
  goalContributions,
  goals,
} from "@projectb/db";
import { and, desc, eq, gt, gte, lt, lte } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getProfile, withUser } from "@/lib/auth";
import { type FormState, respond } from "./state";

const values = (formData: FormData) =>
  Object.fromEntries(
    [...formData.entries()].filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );

// Budgets ---------------------------------------------------------------------

/** Sets a category's limit from the given month on, replacing later changes. */
async function saveBudgetUnstamped(
  locale: Locale,
  formData: FormData,
): Promise<FormState> {
  const submitted = values(formData);
  const parsed = budgetSchema.safeParse(submitted);
  if (!parsed.success) {
    return {
      status: "error",
      fieldErrors: fieldErrors(parsed.error),
      values: submitted,
    };
  }
  const { categoryId, month } = parsed.data;
  const profile = await getProfile();

  const result = await withUser(async (tx): Promise<FormState | null> => {
    const fail = (field: string, error: ValidationError): FormState => ({
      status: "error",
      fieldErrors: { [field]: error },
      values: submitted,
    });
    const [category] = await tx
      .select({ kind: categories.kind })
      .from(categories)
      .where(eq(categories.id, categoryId));
    if (category?.kind !== "expense")
      return fail("categoryId", "invalidCategory");
    // A changed limit keeps the currency it had; new ones use the main currency.
    const [current] = await tx
      .select({ amount: budgets.amount, currency: budgets.currency })
      .from(budgets)
      .where(and(eq(budgets.categoryId, categoryId), lte(budgets.month, month)))
      .orderBy(desc(budgets.month))
      .limit(1);
    const preferred = current?.amount ? current.currency : profile.baseCurrency;
    const currency = isCurrencyCode(preferred) ? preferred : DEFAULT_CURRENCY;
    const amount = parseAmount(parsed.data.amount, currency, locale);
    if ("error" in amount) return fail("amount", amount.error);

    await tx
      .insert(budgets)
      .values({ categoryId, month, amount: amount.amount, currency })
      .onConflictDoUpdate({
        target: [budgets.userId, budgets.categoryId, budgets.month],
        set: { amount: amount.amount, currency },
      });
    await tx
      .delete(budgets)
      .where(and(eq(budgets.categoryId, categoryId), gt(budgets.month, month)));
    return null;
  });
  if (result) return result;
  redirect(`/${locale}/budgets?month=${month.slice(0, 7)}`);
}
export async function saveBudget(
  locale: Locale,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  return respond(await saveBudgetUnstamped(locale, formData));
}

/** Removes a category's budget from the given month on; earlier months keep it. */
export async function removeBudget(
  locale: Locale,
  categoryId: string,
  month: string,
) {
  await withUser(async (tx) => {
    await tx
      .delete(budgets)
      .where(
        and(eq(budgets.categoryId, categoryId), gte(budgets.month, month)),
      );
    const [before] = await tx
      .select({ amount: budgets.amount, currency: budgets.currency })
      .from(budgets)
      .where(and(eq(budgets.categoryId, categoryId), lt(budgets.month, month)))
      .orderBy(desc(budgets.month))
      .limit(1);
    if (before?.amount) {
      await tx
        .insert(budgets)
        .values({ categoryId, month, amount: null, currency: before.currency });
    }
  });
  redirect(`/${locale}/budgets?month=${month.slice(0, 7)}`);
}

// Goals -----------------------------------------------------------------------

async function saveGoalUnstamped(
  locale: Locale,
  goalId: string | null,
  formData: FormData,
): Promise<FormState> {
  const submitted = values(formData);
  const parsed = goalSchema.safeParse(submitted);
  if (!parsed.success) {
    return {
      status: "error",
      fieldErrors: fieldErrors(parsed.error),
      values: submitted,
    };
  }
  const data = parsed.data;

  const result = await withUser(async (tx): Promise<FormState | string> => {
    // A linked goal is kept in its account's currency.
    let currency = data.currency;
    if (data.accountId) {
      const [account] = await tx
        .select({ type: accounts.type, currency: accounts.currency })
        .from(accounts)
        .where(eq(accounts.id, data.accountId));
      if (
        !account ||
        account.type === "credit_card" ||
        !isCurrencyCode(account.currency)
      ) {
        return {
          status: "error",
          fieldErrors: { accountId: "invalidAccount" },
          values: submitted,
        };
      }
      currency = account.currency;
    }
    const target = parseAmount(data.targetAmount, currency, locale);
    if ("error" in target) {
      return {
        status: "error",
        fieldErrors: { targetAmount: target.error },
        values: submitted,
      };
    }
    const row = {
      name: data.name,
      targetAmount: target.amount,
      currency,
      targetDate: data.targetDate,
      accountId: data.accountId,
    };
    if (goalId) {
      const updated = await tx
        .update(goals)
        .set(row)
        .where(eq(goals.id, goalId))
        .returning({ id: goals.id });
      if (updated.length === 0) return { status: "error", error: "unknown" };
      return goalId;
    }
    const [inserted] = await tx
      .insert(goals)
      .values(row)
      .returning({ id: goals.id });
    return inserted!.id;
  });

  if (typeof result !== "string") return result;
  redirect(`/${locale}/goals/${result}`);
}

export async function saveGoal(
  locale: Locale,
  goalId: string | null,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  return respond(await saveGoalUnstamped(locale, goalId, formData));
}

export async function setGoalArchived(
  locale: Locale,
  goalId: string,
  archived: boolean,
) {
  await withUser((tx) =>
    tx
      .update(goals)
      .set({ archivedAt: archived ? new Date() : null })
      .where(eq(goals.id, goalId)),
  );
  redirect(`/${locale}/goals`);
}

export async function deleteGoal(locale: Locale, goalId: string) {
  await withUser((tx) => tx.delete(goals).where(eq(goals.id, goalId)));
  redirect(`/${locale}/goals`);
}

async function addContributionUnstamped(
  locale: Locale,
  goalId: string,
  formData: FormData,
): Promise<FormState> {
  const submitted = values(formData);
  const parsed = contributionSchema.safeParse(submitted);
  if (!parsed.success) {
    return {
      status: "error",
      fieldErrors: fieldErrors(parsed.error),
      values: submitted,
    };
  }
  const data = parsed.data;
  const result = await withUser(async (tx): Promise<FormState | null> => {
    const [goal] = await tx
      .select({ currency: goals.currency })
      .from(goals)
      .where(eq(goals.id, goalId));
    if (!goal || !isCurrencyCode(goal.currency)) {
      return { status: "error", error: "unknown" };
    }
    const amount = parseAmount(data.amount, goal.currency, locale);
    if ("error" in amount) {
      return {
        status: "error",
        fieldErrors: { amount: amount.error },
        values: submitted,
      };
    }
    await tx.insert(goalContributions).values({
      goalId,
      amount: data.direction === "withdraw" ? -amount.amount : amount.amount,
      occurredOn: data.occurredOn,
      note: data.note,
    });
    return null;
  });
  if (result) return result;
  redirect(`/${locale}/goals/${goalId}`);
}

export async function addContribution(
  locale: Locale,
  goalId: string,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  return respond(await addContributionUnstamped(locale, goalId, formData));
}

export async function deleteContribution(
  locale: Locale,
  goalId: string,
  contributionId: string,
) {
  await withUser((tx) =>
    tx
      .delete(goalContributions)
      .where(eq(goalContributions.id, contributionId)),
  );
  redirect(`/${locale}/goals/${goalId}`);
}
