import "server-only";
import {
  addStatements,
  buildStatement,
  type CardSettings,
  debtOn,
  lastStatementOn,
  statementFor,
  upcomingInstallments,
} from "@projectb/core";
import type { AccountWithBalance } from "./finance";
import { getCardTransactions } from "./finance";

export type CardAccount = AccountWithBalance & {
  statementDay: number;
  dueDay: number;
  minPaymentRate: number;
};

/** A credit card with its statement settings filled in. */
export function isConfiguredCard(
  account: AccountWithBalance,
): account is CardAccount {
  return (
    account.type === "credit_card" &&
    account.statementDay !== null &&
    account.dueDay !== null &&
    account.minPaymentRate !== null
  );
}

const settingsOf = (card: CardAccount): CardSettings => ({
  openingBalance: card.openingBalance,
  statementDay: card.statementDay,
  dueDay: card.dueDay,
  minPaymentRate: card.minPaymentRate,
});

/**
 * Everything the card page shows. `statementDate` picks an earlier statement;
 * by default it is the latest one that has closed.
 */
export async function getCardOverview(
  card: CardAccount,
  today: string,
  statementDate?: string,
) {
  const transactions = await getCardTransactions(card.id);
  const settings = settingsOf(card);
  const latest = lastStatementOn(today, card.statementDay);
  const selected =
    statementDate && statementDate <= latest
      ? statementFor(statementDate, card.statementDay)
      : latest;

  const statement = buildStatement(
    settings,
    transactions,
    card.id,
    selected,
    today,
  );
  const next = addStatements(latest, 1, card.statementDay);
  const current = buildStatement(settings, transactions, card.id, next, today);
  const upcoming = upcomingInstallments(
    settings,
    transactions,
    card.id,
    latest,
    6,
  );

  // Statements from the first transaction up to the latest, newest first.
  const first = transactions[0]
    ? statementFor(transactions[0].occurredOn, card.statementDay)
    : latest;
  const history: string[] = [];
  for (let date = latest; date >= first && history.length < 12;) {
    history.push(date);
    date = addStatements(date, -1, card.statementDay);
  }

  return {
    transactions,
    statement,
    current,
    upcoming,
    history,
    latest,
    debt: debtOn(settings, transactions, card.id, today),
  };
}

/** The latest closed statement of each configured card that still has money due. */
export async function getDueStatements(
  accounts: AccountWithBalance[],
  today: string,
) {
  const cards = accounts.filter((a) => !a.archivedAt).filter(isConfiguredCard);
  const results = await Promise.all(
    cards.map(async (card) => {
      const transactions = await getCardTransactions(card.id);
      const statement = buildStatement(
        settingsOf(card),
        transactions,
        card.id,
        lastStatementOn(today, card.statementDay),
        today,
      );
      return { card, statement };
    }),
  );
  return results
    .filter(({ statement }) => statement.remaining > 0)
    .sort((a, b) => a.statement.dueDate.localeCompare(b.statement.dueDate));
}
