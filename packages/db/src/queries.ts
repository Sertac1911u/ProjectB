import { sql } from "drizzle-orm";
import type { Db, Tx } from "./index";
import { exchangeRates } from "./schema";

/**
 * Makes the transaction's tags exactly `names` in one statement: creates
 * missing tags, links them, and unlinks tags that are no longer listed.
 * Postgres compares the names, so case folding matches the unique index.
 */
export async function setTransactionTags(
  tx: Tx,
  transactionId: string,
  names: string[],
) {
  const list = names.length
    ? sql`array[${sql.join(
        names.map((name) => sql`${name}`),
        sql`, `,
      )}]::text[]`
    : sql`'{}'::text[]`;
  await tx.execute(sql`
    with wanted as (
      select n as name from unnest(${list}) as n
    ),
    existing as (
      select id from public.tags where lower(name) in (select lower(name) from wanted)
    ),
    created as (
      insert into public.tags (name) select name from wanted
      on conflict (user_id, lower(name)) do nothing
      returning id
    ),
    unlinked as (
      delete from public.transaction_tags
      where transaction_id = ${transactionId}::uuid and tag_id not in (select id from existing)
    )
    insert into public.transaction_tags (transaction_id, tag_id)
    select ${transactionId}::uuid, id from existing
    union
    select ${transactionId}::uuid, id from created
    on conflict do nothing
  `);
}

/**
 * The latest known rate of each currency on or before `day` (TRY per unit).
 * Rates are shared data, so this runs with the server's own connection.
 */
export async function ratesOn(db: Db, day: string) {
  const rows = await db.execute<{
    currency: string;
    rate_on: string;
    try_per_unit: string;
  }>(sql`
    select distinct on (currency) currency, rate_on::text, try_per_unit::text
    from public.exchange_rates
    where rate_on <= ${day}
    order by currency, rate_on desc
  `);
  return rows.map((row) => ({
    currency: row.currency,
    rateOn: row.rate_on,
    tryPerUnit: Number(row.try_per_unit),
  }));
}

/** Stores one day's rates; a day that is already stored is left as is. */
export async function saveRates(
  db: Db,
  rateOn: string,
  rates: Record<string, number>,
) {
  const entries = Object.entries(rates).filter(
    ([currency]) => currency !== "TRY",
  );
  if (entries.length === 0) return;
  await db
    .insert(exchangeRates)
    .values(
      entries.map(([currency, tryPerUnit]) => ({
        rateOn,
        currency,
        tryPerUnit,
      })),
    )
    .onConflictDoNothing();
}
