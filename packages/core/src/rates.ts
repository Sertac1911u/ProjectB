import { CURRENCIES, type CurrencyCode, isCurrencyCode } from "./currency";
import type { MinorUnits } from "./money";

/**
 * Exchange rates as Turkish lira per one unit of each currency (TRY is 1).
 * Rates come from the Central Bank of the Republic of Turkey (TCMB); the
 * "forex buying" rate is used, the rate assets are commonly valued at.
 */
export type Rates = Partial<Record<CurrencyCode, number>>;

export type TcmbBulletin = { date: string; rates: Rates };

const tag = (block: string, name: string) =>
  block.match(new RegExp(`<${name}>\\s*([^<]*?)\\s*</${name}>`))?.[1];

/**
 * Reads TCMB's daily bulletin (https://www.tcmb.gov.tr/kurlar/today.xml)
 * for the currencies the app supports. Returns null if it is not a bulletin.
 */
export function parseTcmbBulletin(xml: string): TcmbBulletin | null {
  const date = xml.match(/<Tarih_Date[^>]*\bTarih="(\d{2})\.(\d{2})\.(\d{4})"/);
  if (!date) return null;
  const rates: Rates = { TRY: 1 };
  for (const [, code, block] of xml.matchAll(
    /<Currency\b[^>]*\bKod="([A-Z]{3})"[^>]*>([\s\S]*?)<\/Currency>/g,
  )) {
    if (!code || !block || !isCurrencyCode(code) || code === "TRY") continue;
    const rate = Number.parseFloat(tag(block, "ForexBuying") ?? "");
    const unit = Number.parseInt(tag(block, "Unit") ?? "1", 10) || 1;
    if (Number.isFinite(rate) && rate > 0) rates[code] = rate / unit;
  }
  return { date: `${date[3]}-${date[2]}-${date[1]}`, rates };
}

/**
 * Converts an amount between currencies through Turkish lira. Returns null
 * when a rate is missing.
 */
export function convert(
  amount: MinorUnits,
  from: CurrencyCode,
  to: CurrencyCode,
  rates: Rates,
): MinorUnits | null {
  if (from === to) return amount;
  const fromRate = from === "TRY" ? 1 : rates[from];
  const toRate = to === "TRY" ? 1 : rates[to];
  if (!fromRate || !toRate) return null;
  const major =
    (amount / 10 ** CURRENCIES[from].minorUnits) * (fromRate / toRate);
  return Math.round(major * 10 ** CURRENCIES[to].minorUnits);
}

/**
 * Sums amounts in several currencies into one. Amounts without a rate are
 * left out and their currencies listed in `missing`.
 */
export function sumIn(
  amounts: { amount: MinorUnits; currency: CurrencyCode }[],
  to: CurrencyCode,
  rates: Rates,
): { total: MinorUnits; missing: CurrencyCode[] } {
  let total = 0;
  const missing = new Set<CurrencyCode>();
  for (const { amount, currency } of amounts) {
    const converted = convert(amount, currency, to, rates);
    if (converted === null) missing.add(currency);
    else total += converted;
  }
  return { total, missing: [...missing] };
}
