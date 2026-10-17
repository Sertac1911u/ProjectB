import "server-only";
import {
  addStatements,
  type CashEvent,
  cardPayments,
  convert,
  type CurrencyCode,
  DEFAULT_CURRENCY,
  envelopeCycle,
  forecast,
  installmentAmounts,
  isCurrencyCode,
  occurrencesUntil,
  reservedBy,
  type Schedule,
  statementFor,
} from "@projectb/core";
import { envelopes as envelopesTable } from "@projectb/db";
import { asc, isNull } from "drizzle-orm";
import { cache } from "react";
import { getProfile, withUser } from "@/lib/auth";
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
    }
  | { type: "purchase" };

/** A purchase tried out in the "what if I buy this?" simulator. */
export type Purchase =
  | { method: "cash"; amount: number }
  | { method: "card"; amount: number; cardId: string; installments: number };

export const getEnvelopes = cache(async () =>
  withUser((tx) =>
    tx
      .select()
      .from(envelopesTable)
      .where(isNull(envelopesTable.archivedAt))
      .orderBy(asc(envelopesTable.dueOn)),
  ),
);

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
export const getCashForecast = cache(() => computeForecast());

/** The forecast as it would be after buying something today. */
export const simulatePurchase = (purchase: Purchase) =>
  computeForecast(purchase);

async function computeForecast(purchase?: Purchase) {
  const day = today();
  const horizon = addDays(day, HORIZON_DAYS);
  const [accounts, rules, rateInfo, profile, envelopeRows] = await Promise.all([
    getAccounts(),
    getRecurringRules(),
    getRates(),
    getProfile(),
    getEnvelopes(),
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
  if (purchase?.method === "cash") {
    events.push({
      on: day,
      amount: -purchase.amount,
      source: { type: "purchase" },
    });
  } else if (purchase?.method === "card") {
    const card = cards.find((c) => c.id === purchase.cardId);
    if (card) {
      // Each installment is billed on one statement, starting with the open one.
      const first = statementFor(day, card.statementDay);
      const list = cardCharges.get(card.id) ?? [];
      // The amount is typed in the main currency.
      const inCard =
        convert(
          purchase.amount,
          currency,
          code(card.currency),
          rateInfo.rates,
        ) ?? purchase.amount;
      installmentAmounts(inCard, purchase.installments).forEach((amount, k) =>
        list.push({
          on: addStatements(first, k, card.statementDay),
          amount,
        }),
      );
      cardCharges.set(card.id, list);
    }
  }
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

  // Envelopes keep what they should hold by payday out of the money available.
  const monthEnd = monthRange(day).to;
  const windowEnd = payday ? addDays(payday, -1) : monthEnd;
  const envelopes = envelopeRows.map((row) => {
    const schedule = {
      amount: row.amount,
      startOn: row.startOn,
      dueOn: row.dueOn,
      intervalMonths: row.intervalMonths,
    };
    return {
      ...row,
      cycle: envelopeCycle(schedule, day),
      keptOut: toBase(reservedBy(schedule, day, windowEnd), row.currency),
    };
  });
  const reserved = envelopes.reduce((sum, e) => sum + e.keptOut, 0);

  const result = forecast({
    today: day,
    balance: balance - reserved,
    events,
    payday,
    monthEnd,
  });
  return {
    ...result,
    /** Money in spendable accounts, before envelopes. */
    accountBalance: balance,
    cards,
    reserved,
    envelopes,
    currency,
    spendable,
    others: accounts.filter((a) => !a.archivedAt && !isSpendable(a)),
    hasIncomeRule: incomes.length > 0,
    hasRules: rules.some((r) => !r.paused && !r.finished),
    missingRate,
    rateInfo,
  };
}

export type CashForecast = Awaited<ReturnType<typeof computeForecast>>;
