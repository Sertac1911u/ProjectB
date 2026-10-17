import "server-only";
import {
  convert,
  type CurrencyCode,
  DEFAULT_CURRENCY,
  isCurrencyCode,
  monthlyEquivalent,
  periodRange,
  resilience,
  type Schedule,
} from "@projectb/core";
import { cache } from "react";
import { getProfile } from "@/lib/auth";
import { today } from "@/lib/dates";
import { getCashForecast } from "./cashflow";
import { getAccounts } from "./finance";
import { getRates } from "./rates";
import { getRecurringRules } from "./recurring";
import { getMonthlyAverages, getNetWorthHistory } from "./reports";

/** The unexpected expense the resilience page tries out, in Turkish lira. */
const SHOCK_TRY = 15_000_00;

const addDays = (day: string, days: number) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + days * 86_400_000)
    .toISOString()
    .slice(0, 10);

/**
 * How long the user's money would last without income, with the figures
 * that explain it, in the main currency.
 */
export const getResilience = cache(async () => {
  const day = today();
  const lastMonth = periodRange("lastMonth", day);
  const [accounts, rules, forecast, averages, history, rateInfo, profile] =
    await Promise.all([
      getAccounts(),
      getRecurringRules(),
      getCashForecast(),
      getMonthlyAverages(),
      getNetWorthHistory(lastMonth.from, lastMonth.to),
      getRates(),
      getProfile(),
    ]);
  const currency: CurrencyCode = isCurrencyCode(profile.baseCurrency)
    ? profile.baseCurrency
    : DEFAULT_CURRENCY;
  const toBase = (amount: number, from: string) =>
    convert(
      amount,
      isCurrencyCode(from) ? from : DEFAULT_CURRENCY,
      currency,
      rateInfo.rates,
    ) ?? 0;
  const byId = new Map(accounts.map((a) => [a.id, a]));

  const active = accounts.filter((a) => !a.archivedAt);
  const cash = active
    .filter((a) => a.type !== "credit_card")
    .reduce((sum, a) => sum + toBase(a.balance, a.currency), 0);
  const cardDebt = active
    .filter((a) => a.type === "credit_card")
    .reduce((sum, a) => sum - toBase(a.balance, a.currency), 0);
  const reserve = cash - cardDebt;

  // Regular payments and envelopes, spread over a month.
  const essentialRules = rules
    .filter((r) => !r.paused && !r.finished && r.kind === "expense")
    .map((r) => ({
      id: r.id,
      note: r.note,
      categoryId: r.categoryId,
      monthly: toBase(
        monthlyEquivalent(
          r.amount,
          r.frequency as Schedule["frequency"],
          r.intervalCount,
        ),
        byId.get(r.accountId)?.currency ?? currency,
      ),
    }));
  const envelopeMonthly = forecast.envelopes.reduce(
    (sum, e) => sum + toBase(e.cycle.monthly, e.currency),
    0,
  );
  const essentialMonthly =
    essentialRules.reduce((sum, r) => sum + r.monthly, 0) + envelopeMonthly;

  const soon = addDays(day, 30);
  const upcoming30 = forecast.entries
    .filter((e) => e.on <= soon && e.amount < 0)
    .reduce((sum, e) => sum - e.amount, 0);

  const result = resilience({
    reserve,
    upcoming30,
    averageIncome: averages?.income ?? 0,
    averageExpense: averages?.expense ?? 0,
    essentialMonthly,
    shock: toBase(SHOCK_TRY, "TRY"),
  });
  const previous = history.points.at(-1)?.value ?? null;

  return {
    ...result,
    currency,
    cash,
    cardDebt,
    upcoming30,
    essentialMonthly,
    envelopeMonthly,
    essentialRules: essentialRules.sort((a, b) => b.monthly - a.monthly),
    averages,
    /** Reserve at the end of last month, to explain the change. */
    previousReserve: previous,
  };
});
