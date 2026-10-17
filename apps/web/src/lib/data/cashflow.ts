import "server-only";
import {
  type CashEvent,
  cardPayments,
  convert,
  type CurrencyCode,
  DEFAULT_CURRENCY,
  forecast,
  isCurrencyCode,
  occurrencesUntil,
  type Schedule,
} from "@projectb/core";
import { cache } from "react";
import { getProfile } from "@/lib/auth";
import { monthRange, today } from "@/lib/dates";
import { isConfiguredCard, settingsOf } from "./cards";
import {
  type AccountWithBalance,
  getAccounts,
  getCardTransactions,
} from "./finance";
import { getRates } from "./rates";
import { getRecurringRules } from "./recurring";

/** How far ahead the payment calendar looks. */
export const HORIZON_DAYS = 60;

export type CashSource =
  | {
      type: "recurring";
      ruleId: string;
      kind: string;
      note: string | null;
      categoryId: string | null;
      accountId: string;
      toAccountId: string | null;
      /** The rule that sets the payday. */
      payday: boolean;
    }
  | {
      type: "card";
      cardId: string;
      cardName: string;
      statementDate: string;
      overdue: boolean;
    };

const code = (c: string): CurrencyCode =>
  isCurrencyCode(c) ? c : DEFAULT_CURRENCY;

const addDays = (day: string, days: number) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + days * 86_400_000)
    .toISOString()
    .slice(0, 10);

/** Accounts whose money counts as available to spend. */
export const isSpendable = (account: AccountWithBalance) =>
  account.spendable && !account.archivedAt && account.type !== "credit_card";

/**
 * The money available to spend until the next payday, and the scheduled
 * income and payments of the coming weeks, in the main currency.
 */
export const getCashForecast = cache(async () => {
  const day = today();
  const horizon = addDays(day, HORIZON_DAYS);
  const [accounts, rules, rateInfo, profile] = await Promise.all([
    getAccounts(),
    getRecurringRules(),
    getRates(),
    getProfile(),
  ]);
  const currency = code(profile.baseCurrency);
  let missingRate = false;
  const toBase = (amount: number, from: string) => {
    const converted = convert(amount, code(from), currency, rateInfo.rates);
    if (converted === null) missingRate = true;
    return converted ?? 0;
  };
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const spendable = accounts.filter(isSpendable);
  const counts = (id: string | null) =>
    Boolean(id && byId.get(id) && isSpendable(byId.get(id)!));
  const balance = spendable.reduce(
    (sum, a) => sum + toBase(a.balance, a.currency),
    0,
  );

  // The largest regular income into spendable money sets the payday.
  const incomes = rules
    .filter((r) => !r.paused && !r.finished)
    .filter((r) => r.kind === "income" && counts(r.accountId));
  const paydayRule = incomes
    .map((r) => ({
      rule: r,
      amount: toBase(r.amount, byId.get(r.accountId)!.currency),
    }))
    .sort((a, b) => b.amount - a.amount)[0]?.rule;
  const payday =
    paydayRule && paydayRule.nextOn <= horizon ? paydayRule.nextOn : null;

  const events: CashEvent<CashSource>[] = [];
  const cardCharges = new Map<string, { on: string; amount: number }[]>();
  for (const rule of rules) {
    if (rule.paused || rule.finished) continue;
    const schedule: Schedule = {
      startOn: rule.startOn,
      frequency: rule.frequency as Schedule["frequency"],
      interval: rule.intervalCount,
      endOn: rule.endOn,
      maxOccurrences: rule.maxOccurrences,
    };
    const from = byId.get(rule.accountId);
    const to = rule.toAccountId ? byId.get(rule.toAccountId) : undefined;
    if (!from) continue;
    const source: CashSource = {
      type: "recurring",
      ruleId: rule.id,
      kind: rule.kind,
      note: rule.note,
      categoryId: rule.categoryId,
      accountId: rule.accountId,
      toAccountId: rule.toAccountId,
      payday: rule.id === paydayRule?.id,
    };
    for (const on of occurrencesUntil(schedule, rule.occurrences, horizon)) {
      if (rule.kind === "expense" && from.type === "credit_card") {
        // Paid with the card: the money leaves with the card payment.
        const list = cardCharges.get(from.id) ?? [];
        list.push({ on, amount: rule.amount });
        cardCharges.set(from.id, list);
        continue;
      }
      // Transfers to a card are covered by its statement payments.
      if (to?.type === "credit_card") continue;
      let amount = 0;
      if (rule.kind === "income" && counts(from.id)) {
        amount = toBase(rule.amount, from.currency);
      } else if (rule.kind === "expense" && counts(from.id)) {
        amount = -toBase(rule.amount, from.currency);
      } else if (rule.kind === "transfer" && to) {
        if (counts(from.id)) amount -= toBase(rule.amount, from.currency);
        if (counts(to.id))
          amount += toBase(rule.toAmount ?? rule.amount, to.currency);
      }
      if (amount !== 0) events.push({ on, amount, source });
    }
  }

  const cards = accounts.filter((a) => !a.archivedAt).filter(isConfiguredCard);
  await Promise.all(
    cards.map(async (card) => {
      const transactions = await getCardTransactions(card.id);
      const payments = cardPayments(
        settingsOf(card),
        transactions,
        card.id,
        day,
        horizon,
        cardCharges.get(card.id),
      );
      for (const payment of payments) {
        events.push({
          on: payment.on,
          amount: -toBase(payment.amount, card.currency),
          source: {
            type: "card",
            cardId: card.id,
            cardName: card.name,
            statementDate: payment.statementDate,
            overdue: payment.overdue,
          },
        });
      }
    }),
  );

  const result = forecast({
    today: day,
    balance,
    events,
    payday,
    monthEnd: monthRange(day).to,
  });
  return {
    ...result,
    currency,
    spendable,
    others: accounts.filter((a) => !a.archivedAt && !isSpendable(a)),
    hasIncomeRule: incomes.length > 0,
    hasRules: rules.some((r) => !r.paused && !r.finished),
    missingRate,
    rateInfo,
  };
});

export type CashForecast = Awaited<ReturnType<typeof getCashForecast>>;
