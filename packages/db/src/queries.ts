import { sql } from "drizzle-orm";
import type { Tx } from "./index";

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
