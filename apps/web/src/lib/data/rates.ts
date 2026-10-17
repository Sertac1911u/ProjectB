import "server-only";
import { isCurrencyCode, parseTcmbBulletin, type Rates } from "@projectb/core";
import { ratesOn, saveRates } from "@projectb/db";
import { after, connection } from "next/server";
import { cache } from "react";
import { getDb } from "@/lib/db";
import { daysBetween, today } from "@/lib/dates";

const TCMB_URL =
  process.env.TCMB_RATES_URL ?? "https://www.tcmb.gov.tr/kurlar/today.xml";
const RETRY_AFTER_MS = 60 * 60 * 1000;

let lastAttempt = 0;

/** Fetches today's TCMB bulletin and stores it; failures are only logged. */
async function refreshRates() {
  if (Date.now() - lastAttempt < RETRY_AFTER_MS) return;
  lastAttempt = Date.now();
  try {
    const response = await fetch(TCMB_URL, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const bulletin = parseTcmbBulletin(await response.text());
    if (!bulletin) throw new Error("response is not a TCMB bulletin");
    await saveRates(getDb(), bulletin.date, bulletin.rates);
  } catch (error) {
    console.error(
      `[rates] Could not fetch TCMB rates from ${TCMB_URL}:`,
      error,
    );
  }
}

export type RateInfo = {
  rates: Rates;
  /** Bulletin date of the newest rate, if any rate is known. */
  date: string | null;
  /** The newest rate is older than a long weekend. */
  stale: boolean;
};

/**
 * Current exchange rates. Pages get the stored rates right away; when they
 * are not from today, the newest bulletin is fetched after the response.
 */
export const getRates = cache(async (): Promise<RateInfo> => {
  await connection();
  const day = today();
  let rows = await ratesOn(getDb(), day);
  if (rows.length === 0) {
    // Nothing to show yet: wait for the first bulletin once.
    await refreshRates();
    rows = await ratesOn(getDb(), day);
  } else if (rows.every((row) => row.rateOn < day)) {
    after(refreshRates);
  }

  const rates: Rates = { TRY: 1 };
  for (const row of rows) {
    if (isCurrencyCode(row.currency)) rates[row.currency] = row.tryPerUnit;
  }
  const date = rows.reduce<string | null>(
    (newest, row) =>
      newest === null || row.rateOn > newest ? row.rateOn : newest,
    null,
  );
  return { rates, date, stale: date !== null && daysBetween(date, day) > 4 };
});
