import { sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { asUser, createDb, exchangeRates, ratesOn, saveRates } from "./index";

// See rls.test.ts: needs a Supabase database with migrations applied.
const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("exchange rates", () => {
  const db = createDb(url!);
  // Far in the past so real data does not interfere.
  const days = ["1990-01-02", "1990-01-03"];

  afterAll(async () => {
    await db.execute(
      sql`delete from public.exchange_rates where rate_on < '1991-01-01'`,
    );
    await db.$client.end();
  });

  it("returns the latest rate of each currency on or before a day", async () => {
    await saveRates(db, days[0]!, { TRY: 1, USD: 1.5, EUR: 2 });
    await saveRates(db, days[1]!, { USD: 1.75 });
    // Saving a stored day again changes nothing.
    await saveRates(db, days[1]!, { USD: 9 });

    const rates = await ratesOn(db, "1990-01-10");
    expect(rates.filter((r) => ["USD", "EUR"].includes(r.currency))).toEqual([
      { currency: "EUR", rateOn: "1990-01-02", tryPerUnit: 2 },
      { currency: "USD", rateOn: "1990-01-03", tryPerUnit: 1.75 },
    ]);
    const earlier = await ratesOn(db, "1990-01-02");
    expect(earlier.find((r) => r.currency === "USD")?.tryPerUnit).toBe(1.5);
  });

  it("lets signed-in users read rates but not change them", async () => {
    const claims = {
      sub: "00000000-0000-0000-0000-000000000000",
      role: "authenticated",
    };
    const rows = await asUser(db, claims, (tx) =>
      tx.select().from(exchangeRates),
    );
    expect(rows.length).toBeGreaterThan(0);
    const write = await asUser(db, claims, (tx) =>
      tx
        .insert(exchangeRates)
        .values({ rateOn: "1990-01-04", currency: "USD", tryPerUnit: 1 }),
    ).catch((e: Error) => String(e.cause));
    expect(write).toMatch(/permission denied/);
  });
});
