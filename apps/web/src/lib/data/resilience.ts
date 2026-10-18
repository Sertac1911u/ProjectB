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
import { getBalancesOn, getMonthlyAverages } from "./reports";

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
  const [accounts, rules, forecast, averages, rateInfo, profile, then] =
    await Promise.all([
      getAccounts(),
      getRecurringRules(),
      getCashForecast(),
      getMonthlyAverages(),
      getRates(),
      getProfile(),
      getBalancesOn(lastMonth.to),
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
  // Loans are paid off over years through their installments (counted as
  // regular payments), so they do not reduce the reserve.
  const cash = active
    .filter((a) => a.type !== "credit_card" && a.type !== "loan")
    .reduce((sum, a) => sum + toBase(a.balance, a.currency), 0);
  const cardDebt = active
    .filter((a) => a.type === "credit_card")
    .reduce((sum, a) => sum - toBase(a.balance, a.currency), 0);
  const reserve = cash - cardDebt;

  // Regular payments, loan installments and envelopes, spread over a month.
  // Loan installments are transfers, so the spending history leaves them
  // out; they go on even if income stops.
  const isLoan = (id: string | null) => byId.get(id ?? "")?.type === "loan";
  const essentialRules = rules
    .filter((r) => !r.paused && !r.finished)
    .filter(
      (r) =>
        r.kind === "expense" ||
        (r.kind === "transfer" && isLoan(r.toAccountId)),
    )
    .map((r) => ({
      id: r.id,
      note: r.note,
      categoryId: r.categoryId,
      loan: r.kind === "transfer",
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

  const loanMonthly = essentialRules
    .filter((r) => r.loan)
    .reduce((sum, r) => sum + r.monthly, 0);
  const result = resilience({
    reserve,
    upcoming30,
    averageIncome: averages?.income ?? 0,
    averageExpense: averages ? averages.expense + loanMonthly : 0,
    essentialMonthly,
    shock: toBase(SHOCK_TRY, "TRY"),
  });
  // The change since last month compares only accounts that existed then,
  // so an account added today does not look like money gained. Gold is
  // revalued by hand, so its value has no history.
  let change: number | null = null;
  for (const a of active) {
    if (a.type === "loan" || a.type === "gold") continue;
    const before = then.get(a.id);
    if (before == null) continue;
    change =
      (change ?? 0) +
      toBase(a.balance, a.currency) -
      toBase(before, a.currency);
  }

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
    loanMonthly,
    /** How the reserve changed since the end of last month. */
    change,
  };
});
