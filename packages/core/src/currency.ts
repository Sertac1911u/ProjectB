export const CURRENCIES = {
  TRY: { minorUnits: 2 },
  USD: { minorUnits: 2 },
  EUR: { minorUnits: 2 },
  GBP: { minorUnits: 2 },
} as const;

export type CurrencyCode = keyof typeof CURRENCIES;

export const DEFAULT_CURRENCY: CurrencyCode = "TRY";

export function isCurrencyCode(value: string): value is CurrencyCode {
  return Object.hasOwn(CURRENCIES, value);
}
