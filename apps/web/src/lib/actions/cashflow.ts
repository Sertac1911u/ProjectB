"use server";

import {
  addStatements,
  DEFAULT_CURRENCY,
  dueDate,
  envelopeCycle,
  envelopeSchema,
  fieldErrors,
  goalDelayDays,
  installmentAmounts,
  isCurrencyCode,
  type Locale,
  MAX_INSTALLMENTS,
  parseAmount,
  statementFor,
} from "@projectb/core";
import { envelopes } from "@projectb/db";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getProfile, withUser } from "@/lib/auth";
import { isConfiguredCard } from "@/lib/data/cards";
import {
  type CashForecast,
  getCashForecast,
  getEnvelopes,
  type Purchase,
  simulatePurchase,
} from "@/lib/data/cashflow";
import { getAccounts } from "@/lib/data/finance";
import { getGoals } from "@/lib/data/planning";
import { getMonthlyAverages } from "@/lib/data/reports";
import { today } from "@/lib/dates";
import { type FormState, respond } from "./state";

const values = (formData: FormData) =>
  Object.fromEntries(
    [...formData.entries()].filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );

// "What if I buy this?" -------------------------------------------------------

type Outlook = {
  dailyLimit: number;
  safeToSpend: number;
  windowEndBalance: number;
  lowest: { on: string; balance: number };
  shortfallOn: string | null;
};

export type WhatIfState = FormState & {
  result?: {
    currency: string;
    toPayday: boolean;
    before: Outlook;
    after: Outlook;
    /** Card installments and the payments they are billed with. */
    cardPlan: { due: string; amount: number }[];
    goals: { id: string; name: string; delayDays: number | null }[];
  };
};

const outlook = (f: CashForecast): Outlook => ({
  dailyLimit: f.dailyLimit,
  safeToSpend: f.safeToSpend,
  windowEndBalance: f.windowEndBalance,
  lowest: f.lowest,
  shortfallOn: f.shortfalls.find((e) => e.beforePayday)?.on ?? null,
});

export async function whatIf(
  locale: Locale,
  _: WhatIfState,
  formData: FormData,
): Promise<WhatIfState> {
  const submitted = values(formData);
  const profile = await getProfile();
  const currency = isCurrencyCode(profile.baseCurrency)
    ? profile.baseCurrency
    : DEFAULT_CURRENCY;
  const parsed = parseAmount(submitted.amount ?? "", currency, locale);
  if ("error" in parsed) {
    return respond({
      status: "error",
      fieldErrors: { amount: parsed.error },
      values: submitted,
    });
  }
  const amount = parsed.amount;
  const accounts = await getAccounts();
  const card = accounts
    .filter(isConfiguredCard)
    .find((a) => a.id === submitted.method && !a.archivedAt);
  const installments = Math.min(
    MAX_INSTALLMENTS,
    Math.max(1, Number.parseInt(submitted.installments ?? "1", 10) || 1),
  );
  const purchase: Purchase = card
    ? { method: "card", amount, cardId: card.id, installments }
    : { method: "cash", amount };

  const [before, after, goals, averages] = await Promise.all([
    getCashForecast(),
    simulatePurchase(purchase),
    getGoals(),
    getMonthlyAverages(),
  ]);
  const day = today();
  const cardPlan = card
    ? installmentAmounts(amount, installments).map((part, k) => ({
        due: dueDate(
          addStatements(
            statementFor(day, card.statementDay),
            k,
            card.statementDay,
          ),
          card.dueDay,
        ),
        amount: part,
      }))
    : [];

  return respond({
    status: "success",
    values: submitted,
    result: {
      currency,
      toPayday: before.payday !== null,
      before: outlook(before),
      after: outlook(after),
      cardPlan,
      goals: goals
        .filter((g) => !g.archivedAt && !g.progress.reached)
        .map((g) => ({
          id: g.id,
          name: g.name,
          delayDays: goalDelayDays(amount, averages?.saving ?? null),
        })),
    },
  });
}

// Envelopes -------------------------------------------------------------------

async function saveEnvelopeUnstamped(
  locale: Locale,
  envelopeId: string | null,
  formData: FormData,
): Promise<FormState> {
  const submitted = values(formData);
  const parsed = envelopeSchema.safeParse(submitted);
  if (!parsed.success) {
    return {
      status: "error",
      fieldErrors: fieldErrors(parsed.error),
      values: submitted,
    };
  }
  const data = parsed.data;
  const day = today();
  if (data.dueOn < day) {
    return {
      status: "error",
      fieldErrors: { dueOn: "invalidEndDate" },
      values: submitted,
    };
  }
  const profile = await getProfile();
  const currency = isCurrencyCode(profile.baseCurrency)
    ? profile.baseCurrency
    : DEFAULT_CURRENCY;
  const amount = parseAmount(data.amount, currency, locale);
  if ("error" in amount) {
    return {
      status: "error",
      fieldErrors: { amount: amount.error },
      values: submitted,
    };
  }
  const row = {
    name: data.name,
    amount: amount.amount,
    dueOn: data.dueOn,
    intervalMonths: data.repeat,
  };
  await withUser(async (tx) => {
    if (envelopeId) {
      // Saving for the current payment keeps its start; a due date moved
      // before that start begins afresh today.
      const [current] = await tx
        .select()
        .from(envelopes)
        .where(eq(envelopes.id, envelopeId));
      const start = current ? envelopeCycle(current, day).start : day;
      const startOn = start <= data.dueOn ? start : day;
      await tx
        .update(envelopes)
        .set({ ...row, startOn })
        .where(eq(envelopes.id, envelopeId));
    } else {
      await tx.insert(envelopes).values({ ...row, currency, startOn: day });
    }
  });
  redirect(`/${locale}/cashflow`);
}

export async function saveEnvelope(
  locale: Locale,
  envelopeId: string | null,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  return respond(await saveEnvelopeUnstamped(locale, envelopeId, formData));
}

/**
 * Marks the current payment as made: a repeating envelope starts saving for
 * the next one, a one-time envelope is archived.
 */
export async function markEnvelopePaid(locale: Locale, envelopeId: string) {
  const envelope = (await getEnvelopes()).find((e) => e.id === envelopeId);
  if (envelope) {
    const day = today();
    const cycle = envelopeCycle(envelope, day);
    await withUser((tx) => {
      if (!envelope.intervalMonths) {
        return tx
          .update(envelopes)
          .set({ archivedAt: new Date() })
          .where(eq(envelopes.id, envelopeId));
      }
      // The cycle after this one: as if the day after the due date.
      const next = envelopeCycle(
        { ...envelope, startOn: cycle.start, dueOn: cycle.due },
        new Date(Date.parse(`${cycle.due}T00:00:00Z`) + 86_400_000)
          .toISOString()
          .slice(0, 10),
      );
      return tx
        .update(envelopes)
        .set({ startOn: next.start, dueOn: next.due })
        .where(eq(envelopes.id, envelopeId));
    });
  }
  redirect(`/${locale}/cashflow`);
}

export async function deleteEnvelope(locale: Locale, envelopeId: string) {
  await withUser((tx) =>
    tx.delete(envelopes).where(eq(envelopes.id, envelopeId)),
  );
  redirect(`/${locale}/cashflow`);
}
