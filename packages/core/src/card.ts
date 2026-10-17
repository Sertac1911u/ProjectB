import type { MinorUnits } from "./money";

/**
 * Credit card statements, computed from the card's transactions. Dates are
 * calendar dates written as YYYY-MM-DD.
 *
 * A statement closes on the card's statement day each month (clamped to the
 * month's last day) and covers the days after the previous statement up to
 * and including that date. Payment is due on the first `dueDay` after it.
 *
 * Installment purchases count against the debt in full right away; their
 * installments are billed one per statement, starting with the statement
 * whose period contains the purchase. The amount of a statement is therefore
 * the debt on its closing date minus the installments not billed yet, which
 * also carries over anything left unpaid from earlier statements.
 */

export const MAX_INSTALLMENTS = 36;
export const INSTALLMENT_OPTIONS = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 18, 24, 36,
] as const;

export type CardSettings = {
  openingBalance: MinorUnits;
  statementDay: number;
  dueDay: number;
  /** Minimum payment as a percentage of the statement amount, e.g. 20. */
  minPaymentRate: number;
};

export type CardTransaction = {
  id: string;
  kind: string;
  accountId: string;
  toAccountId: string | null;
  amount: MinorUnits;
  toAmount: MinorUnits | null;
  occurredOn: string;
  installmentCount: number;
};

// Calendar helpers -------------------------------------------------------------

const pad = (n: number) => String(n).padStart(2, "0");

function parts(day: string): [number, number, number] {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  return [y, m, d];
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** The given day of a month, moved back to the last day if the month is shorter. */
export function dayOfMonth(year: number, month: number, day: number): string {
  // Normalise months outside 1..12 (e.g. month 13 is January next year).
  const date = new Date(Date.UTC(year, month - 1, 1));
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  return `${y}-${pad(m)}-${pad(Math.min(day, daysInMonth(y, m)))}`;
}

/** The statement date `count` statements after the one on `statementDate`. */
export function addStatements(
  statementDate: string,
  count: number,
  statementDay: number,
) {
  const [y, m] = parts(statementDate);
  return dayOfMonth(y, m + count, statementDay);
}

/** Closing date of the statement whose period contains `day`. */
export function statementFor(day: string, statementDay: number): string {
  const [y, m] = parts(day);
  const thisMonth = dayOfMonth(y, m, statementDay);
  return day <= thisMonth ? thisMonth : dayOfMonth(y, m + 1, statementDay);
}

/** The most recent statement date on or before `day`. */
export function lastStatementOn(day: string, statementDay: number): string {
  const closing = statementFor(day, statementDay);
  return closing === day ? closing : addStatements(closing, -1, statementDay);
}

/** Payment due date: the first `dueDay` after the statement date. */
export function dueDate(statementDate: string, dueDay: number): string {
  const [y, m] = parts(statementDate);
  const sameMonth = dayOfMonth(y, m, dueDay);
  return sameMonth > statementDate ? sameMonth : dayOfMonth(y, m + 1, dueDay);
}

// Amounts ----------------------------------------------------------------------

/** Splits a total into `count` installments; leftover minor units go first. */
export function installmentAmounts(
  total: MinorUnits,
  count: number,
): MinorUnits[] {
  const base = Math.floor(total / count);
  const rest = total - base * count;
  return Array.from({ length: count }, (_, i) => base + (i < rest ? 1 : 0));
}

/** How a transaction changes the card's debt: positive adds to it. */
function debtChange(tx: CardTransaction, cardId: string): MinorUnits {
  if (tx.kind === "transfer" && tx.toAccountId === cardId)
    return -(tx.toAmount ?? tx.amount);
  if (tx.accountId !== cardId) return 0;
  return tx.kind === "income" ? -tx.amount : tx.amount;
}

const isInstallmentPurchase = (tx: CardTransaction, cardId: string) =>
  tx.kind === "expense" && tx.accountId === cardId && tx.installmentCount > 1;

export type StatementLine = {
  transactionId: string;
  occurredOn: string;
  /** Positive for charges, negative for payments and refunds. */
  amount: MinorUnits;
  /** For installments: which one this is, e.g. 3 of 6. */
  installment?: { number: number; count: number };
};

export type Statement = {
  /** Day after the previous statement date. */
  periodStart: string;
  statementDate: string;
  dueDate: string;
  lines: StatementLine[];
  /** What is owed for this statement; zero or less means nothing is due. */
  amount: MinorUnits;
  minimumPayment: MinorUnits;
  /** Payments and refunds made after the statement date. */
  paidSince: MinorUnits;
  remaining: MinorUnits;
};

/** Installments of a purchase billed on the given statement, if any. */
function installmentOn(
  tx: CardTransaction,
  statementDate: string,
  statementDay: number,
) {
  const first = statementFor(tx.occurredOn, statementDay);
  for (let k = 0; k < tx.installmentCount; k++) {
    const closing = addStatements(first, k, statementDay);
    if (closing === statementDate) return k;
    if (closing > statementDate) return null;
  }
  return null;
}

/** Installment amounts of all purchases that are billed after `statementDate`. */
function unbilledAfter(
  transactions: CardTransaction[],
  cardId: string,
  statementDate: string,
  statementDay: number,
) {
  let total = 0;
  for (const tx of transactions) {
    if (!isInstallmentPurchase(tx, cardId) || tx.occurredOn > statementDate)
      continue;
    const amounts = installmentAmounts(tx.amount, tx.installmentCount);
    const first = statementFor(tx.occurredOn, statementDay);
    amounts.forEach((amount, k) => {
      if (addStatements(first, k, statementDay) > statementDate)
        total += amount;
    });
  }
  return total;
}

/** Total debt on the card at the end of `day` (positive means owed). */
export function debtOn(
  card: Pick<CardSettings, "openingBalance">,
  transactions: CardTransaction[],
  cardId: string,
  day: string,
): MinorUnits {
  let debt = -card.openingBalance;
  for (const tx of transactions) {
    if (tx.occurredOn <= day) debt += debtChange(tx, cardId);
  }
  return debt;
}

export function buildStatement(
  card: CardSettings,
  transactions: CardTransaction[],
  cardId: string,
  statementDate: string,
  today: string,
): Statement {
  const previous = addStatements(statementDate, -1, card.statementDay);
  const [py, pm, pd] = parts(previous);
  const periodStart = new Date(Date.UTC(py, pm - 1, pd + 1))
    .toISOString()
    .slice(0, 10);

  const lines: StatementLine[] = [];
  for (const tx of transactions) {
    if (isInstallmentPurchase(tx, cardId)) {
      const k = installmentOn(tx, statementDate, card.statementDay);
      if (k === null) continue;
      lines.push({
        transactionId: tx.id,
        occurredOn: tx.occurredOn,
        amount: installmentAmounts(tx.amount, tx.installmentCount)[k]!,
        installment: { number: k + 1, count: tx.installmentCount },
      });
    } else if (tx.occurredOn > previous && tx.occurredOn <= statementDate) {
      const amount = debtChange(tx, cardId);
      if (amount !== 0)
        lines.push({ transactionId: tx.id, occurredOn: tx.occurredOn, amount });
    }
  }
  lines.sort((a, b) => a.occurredOn.localeCompare(b.occurredOn));

  const amount =
    debtOn(card, transactions, cardId, statementDate) -
    unbilledAfter(transactions, cardId, statementDate, card.statementDay);
  const minimumPayment =
    amount > 0 ? Math.round((amount * card.minPaymentRate) / 100) : 0;
  let paidSince = 0;
  for (const tx of transactions) {
    if (tx.occurredOn > statementDate && tx.occurredOn <= today) {
      const change = debtChange(tx, cardId);
      if (change < 0) paidSince -= change;
    }
  }

  return {
    periodStart,
    statementDate,
    dueDate: dueDate(statementDate, card.dueDay),
    lines,
    amount,
    minimumPayment,
    paidSince,
    remaining: Math.max(0, amount - paidSince),
  };
}

/** Installments to be billed on each of the next `count` statements after `after`. */
export function upcomingInstallments(
  card: Pick<CardSettings, "statementDay">,
  transactions: CardTransaction[],
  cardId: string,
  after: string,
  count: number,
): { statementDate: string; amount: MinorUnits }[] {
  return Array.from({ length: count }, (_, i) => {
    const statementDate = addStatements(after, i + 1, card.statementDay);
    let amount = 0;
    for (const tx of transactions) {
      if (!isInstallmentPurchase(tx, cardId)) continue;
      const k = installmentOn(tx, statementDate, card.statementDay);
      if (k !== null)
        amount += installmentAmounts(tx.amount, tx.installmentCount)[k]!;
    }
    return { statementDate, amount };
  });
}
