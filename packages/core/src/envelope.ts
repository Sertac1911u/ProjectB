/**
 * Envelopes put money aside for rare, known payments: a yearly insurance,
 * taxes, a holiday. The money stays in the account, but the share that
 * should be set aside by now no longer counts as available to spend.
 */
import type { MinorUnits } from "./money";
import { occurrenceDate } from "./recurring";

export const MAX_ENVELOPE_INTERVAL = 60;

export type Envelope = {
  amount: MinorUnits;
  /** When saving for the current payment started. */
  startOn: string;
  /** The payment's date; repeating envelopes move on after it. */
  dueOn: string;
  /** Months between payments, or null for a one-time payment. */
  intervalMonths: number | null;
};

const DAY = 86_400_000;
const days = (from: string, to: string) =>
  Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY,
  );

/** Whole months from one day to another (at least 1). */
export function wholeMonths(from: string, to: string): number {
  const [y1, m1, d1] = from.split("-").map(Number) as [number, number, number];
  const [y2, m2, d2] = to.split("-").map(Number) as [number, number, number];
  return Math.max(1, (y2 - y1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0));
}

export type EnvelopeCycle = {
  start: string;
  due: string;
  /** A one-time payment whose date has passed. */
  passed: boolean;
  /** What should be set aside by today. */
  reserved: MinorUnits;
  /** The steady monthly amount that reaches the payment on time. */
  monthly: MinorUnits;
  percent: number;
};

/** The payment an envelope is saving for now; repeating ones roll over. */
export function envelopeCycle(
  envelope: Envelope,
  today: string,
): EnvelopeCycle {
  let start = envelope.startOn;
  let due = envelope.dueOn;
  if (envelope.intervalMonths) {
    const schedule = {
      startOn: envelope.dueOn,
      frequency: "monthly" as const,
      interval: envelope.intervalMonths,
      endOn: null,
      maxOccurrences: null,
    };
    for (let k = 1; due < today; k++) {
      start = due;
      due = occurrenceDate(schedule, k);
    }
  }
  const passed = due < today;
  const reserved = passed ? 0 : reservedOn(envelope.amount, start, due, today);
  return {
    start,
    due,
    passed,
    reserved,
    monthly: Math.ceil(envelope.amount / wholeMonths(start, due)),
    percent: envelope.amount > 0 ? (reserved / envelope.amount) * 100 : 0,
  };
}

/** The share of `amount` saved up evenly between `start` and `due` by `day`. */
export function reservedOn(
  amount: MinorUnits,
  start: string,
  due: string,
  day: string,
): MinorUnits {
  const total = days(start, due);
  if (total <= 0 || day >= due) return amount;
  if (day <= start) return 0;
  return Math.round((amount * days(start, day)) / total);
}

/**
 * What an envelope keeps out of the money available until `windowEnd`:
 * everything due by then, or the share to set aside until then.
 */
export function reservedBy(
  envelope: Envelope,
  today: string,
  windowEnd: string,
): MinorUnits {
  const cycle = envelopeCycle(envelope, today);
  if (cycle.passed) return 0;
  return reservedOn(envelope.amount, cycle.start, cycle.due, windowEnd);
}
