/**
 * Cash flow forecast: what the money available to spend will look like in
 * the coming days, from scheduled income and payments. Spending the user has
 * not planned is not predicted; the forecast says how much room there is
 * for it instead.
 */
import {
  addStatements,
  buildStatement,
  type CardSettings,
  type CardTransaction,
  dueDate,
  lastStatementOn,
  statementFor,
  upcomingInstallments,
} from "./card";
import type { MinorUnits } from "./money";
import { isWithinSchedule, occurrenceDate, type Schedule } from "./recurring";

const DAY = 86_400_000;
const shift = (day: string, days: number) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY)
    .toISOString()
    .slice(0, 10);
const daysFrom = (from: string, to: string) =>
  Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY,
  );

/** Dates of a schedule from occurrence `from` up to and including `until`. */
export function occurrencesUntil(
  schedule: Schedule,
  from: number,
  until: string,
): string[] {
  const dates: string[] = [];
  for (let k = from; isWithinSchedule(schedule, k); k++) {
    const date = occurrenceDate(schedule, k);
    if (date > until) break;
    dates.push(date);
  }
  return dates;
}

export type CardPayment = {
  /** The due date, or today when the payment is already late. */
  on: string;
  statementDate: string;
  dueDate: string;
  amount: MinorUnits;
  overdue: boolean;
};

/**
 * Card payments due up to `until`, assuming each statement is paid in full
 * on its due date. Charges planned for later (such as recurring expenses on
 * the card) are added to the statement they will be billed on.
 */
export function cardPayments(
  card: CardSettings,
  transactions: CardTransaction[],
  cardId: string,
  today: string,
  until: string,
  planned: { on: string; amount: MinorUnits }[] = [],
): CardPayment[] {
  const latest = lastStatementOn(today, card.statementDay);
  const payments: CardPayment[] = [];
  const closed = buildStatement(card, transactions, cardId, latest, today);
  if (closed.remaining > 0) {
    const overdue = closed.dueDate < today;
    payments.push({
      on: overdue ? today : closed.dueDate,
      statementDate: latest,
      dueDate: closed.dueDate,
      amount: closed.remaining,
      overdue,
    });
  }

  const plannedOn = (statementDate: string) =>
    planned
      .filter((p) => statementFor(p.on, card.statementDay) === statementDate)
      .reduce((sum, p) => sum + p.amount, 0);

  // The open period: everything owed by now, minus what the closed statement
  // already asks for (assumed paid) and installments billed later.
  const next = addStatements(latest, 1, card.statementDay);
  const open = buildStatement(card, transactions, cardId, next, today);
  const later = upcomingInstallments(card, transactions, cardId, next, 12);
  const statements = [
    {
      statementDate: next,
      amount: Math.max(0, open.amount - closed.remaining) + plannedOn(next),
    },
    ...later.map((s) => ({
      statementDate: s.statementDate,
      amount: s.amount + plannedOn(s.statementDate),
    })),
  ];
  for (const statement of statements) {
    const due = dueDate(statement.statementDate, card.dueDay);
    if (due > until) break;
    if (statement.amount > 0) {
      payments.push({
        on: due,
        statementDate: statement.statementDate,
        dueDate: due,
        amount: statement.amount,
        overdue: false,
      });
    }
  }
  return payments;
}

export type CashEvent<S = unknown> = {
  on: string;
  /** Positive adds to the money available, negative takes from it. */
  amount: MinorUnits;
  /** Whatever the caller needs to describe or link the event. */
  source: S;
};

export type ForecastEntry<S = unknown> = CashEvent<S> & {
  /** Money available after this event. */
  balance: MinorUnits;
  /** The event happens before the next payday, inside the planning window. */
  beforePayday: boolean;
};

export type Forecast<S = unknown> = {
  today: string;
  /** Next income day, or null when no regular income is known. */
  payday: string | null;
  /** Last day the daily limit covers: the day before payday or month end. */
  windowEnd: string;
  /** Days the money has to last, today included. */
  daysLeft: number;
  startBalance: MinorUnits;
  entries: ForecastEntry<S>[];
  /** Lowest balance before payday, from scheduled events alone. */
  lowest: { on: string; balance: MinorUnits };
  /** What can be spent before payday without dropping below zero. */
  safeToSpend: MinorUnits;
  dailyLimit: MinorUnits;
  /** Balance just before payday if nothing else is spent. */
  windowEndBalance: MinorUnits;
  /** Events after which the balance first drops below zero. */
  shortfalls: ForecastEntry<S>[];
};

/**
 * Runs the money available today through the scheduled events. Payments on
 * a day come before income on that day, so the forecast errs on the safe side.
 */
export function forecast<S>({
  today,
  balance,
  events,
  payday,
  monthEnd,
}: {
  today: string;
  balance: MinorUnits;
  events: CashEvent<S>[];
  payday: string | null;
  /** Used as the end of the window when there is no payday. */
  monthEnd: string;
}): Forecast<S> {
  const windowEnd = payday ? shift(payday, -1) : monthEnd;
  const daysLeft = Math.max(1, daysFrom(today, windowEnd) + 1);
  const sorted = events
    .filter((e) => e.on >= today && e.amount !== 0)
    .sort((a, b) =>
      a.on !== b.on ? (a.on < b.on ? -1 : 1) : a.amount - b.amount,
    );

  let running = balance;
  let lowest = { on: today, balance };
  let below = balance < 0;
  const shortfalls: ForecastEntry<S>[] = [];
  const entries = sorted.map((event) => {
    running += event.amount;
    const entry: ForecastEntry<S> = {
      ...event,
      balance: running,
      beforePayday: event.on <= windowEnd,
    };
    if (entry.beforePayday && running < lowest.balance) {
      lowest = { on: event.on, balance: running };
    }
    if (running < 0 && !below) shortfalls.push(entry);
    below = running < 0;
    return entry;
  });
  const windowEndBalance =
    entries.filter((e) => e.beforePayday).at(-1)?.balance ?? balance;
  const safeToSpend = lowest.balance;

  return {
    today,
    payday,
    windowEnd,
    daysLeft,
    startBalance: balance,
    entries,
    lowest,
    safeToSpend,
    dailyLimit: Math.max(0, Math.floor(safeToSpend / daysLeft)),
    windowEndBalance,
    shortfalls,
  };
}

/** What spending `amount` today does to the forecast's limits. */
export function spendImpact(
  result: Pick<Forecast, "safeToSpend" | "daysLeft" | "windowEndBalance">,
  amount: MinorUnits,
) {
  const safe = result.safeToSpend - amount;
  return {
    safeToSpend: safe,
    dailyLimit: Math.max(0, Math.floor(safe / result.daysLeft)),
    windowEndBalance: result.windowEndBalance - amount,
    fits: safe >= 0,
  };
}
