import { CURRENCIES, type CurrencyCode } from "./currency";

/**
 * Amounts are always stored as integers in the currency's minor unit
 * (e.g. kuruş for TRY) to avoid floating point rounding errors.
 * 12,50 TL is stored as 1250.
 */
export type MinorUnits = number;

function assertMinorUnits(amount: MinorUnits): void {
  if (!Number.isSafeInteger(amount)) {
    throw new RangeError(`Amount must be a safe integer, got ${amount}`);
  }
}

export function formatMoney(
  amount: MinorUnits,
  currency: CurrencyCode,
  locale: string,
): string {
  assertMinorUnits(amount);
  const { minorUnits } = CURRENCIES[currency];
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    // "₺1,250.00" rather than "TRY 1,250.00" in English.
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: minorUnits,
    maximumFractionDigits: minorUnits,
  }).format(amount / 10 ** minorUnits);
}

function separators(locale: string): { group: string; decimal: string } {
  const parts = new Intl.NumberFormat(locale).formatToParts(1234567.8);
  return {
    group: parts.find((p) => p.type === "group")?.value ?? ",",
    decimal: parts.find((p) => p.type === "decimal")?.value ?? ".",
  };
}

/**
 * Parses an amount typed by the user in the given locale's notation
 * ("1.234,56" in Turkish, "1,234.56" in English) into minor units.
 * Returns null when the input is not a valid amount for the currency.
 */
export function parseMoney(
  input: string,
  currency: CurrencyCode,
  locale: string,
): MinorUnits | null {
  return parseScaled(input, CURRENCIES[currency].minorUnits, locale);
}

/**
 * Parses a number typed in the locale's notation into an integer scaled by
 * 10^decimals: "3,49" with 2 decimals is 349. Null if it has more decimals.
 */
export function parseScaled(
  input: string,
  decimals: number,
  locale: string,
): number | null {
  const { group, decimal } = separators(locale);

  // Some locales group digits with (no-break) spaces; whitespace never
  // carries meaning in an amount, so drop it entirely.
  let text = input.replace(/\s/g, "");

  const negative = text.startsWith("-");
  if (negative) text = text.slice(1);

  const [integerPart = "", fractionPart = "", ...rest] = text.split(decimal);
  if (rest.length > 0) return null;

  const groupPattern = new RegExp(`^\\d{1,3}(${escapeRegExp(group)}\\d{3})*$`);
  const integerDigits = /^\d+$/.test(integerPart)
    ? integerPart
    : groupPattern.test(integerPart)
      ? integerPart.replaceAll(group, "")
      : null;
  if (integerDigits === null) return null;

  if (!/^\d*$/.test(fractionPart) || fractionPart.length > decimals) {
    return null;
  }

  const amount = Number(integerDigits + fractionPart.padEnd(decimals, "0"));
  if (!Number.isSafeInteger(amount)) return null;
  return negative ? -amount : amount;
}

/** Formats an integer scaled by 10^decimals for an input field: 349 -> "3,49". */
export function formatScaled(value: number, decimals: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(value / 10 ** decimals);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Formats minor units for an input field: "1.250,50" in Turkish, no symbol. */
export function formatAmountInput(
  amount: MinorUnits,
  currency: CurrencyCode,
  locale: string,
): string {
  assertMinorUnits(amount);
  const { minorUnits } = CURRENCIES[currency];
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: minorUnits,
    maximumFractionDigits: minorUnits,
  }).format(amount / 10 ** minorUnits);
}
