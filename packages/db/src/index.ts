import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export function createDb(databaseUrl: string) {
  // Supabase's transaction pooler does not support prepared statements.
  const client = postgres(databaseUrl, { prepare: false });
  return drizzle(client, { schema });
}

export type Db = ReturnType<typeof createDb>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/** The verified JWT claims of the signed-in user. */
export type JwtClaims = { sub: string; role?: string } & Record<
  string,
  unknown
>;

/**
 * Runs queries as the signed-in user, so Postgres row level security applies
 * exactly as it does for the mobile app talking to Supabase directly.
 */
export function asUser<T>(
  db: Db,
  claims: JwtClaims,
  run: (tx: Tx) => Promise<T>,
) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`
      select
        set_config('request.jwt.claims', ${JSON.stringify(claims)}, true),
        set_config('request.jwt.claim.sub', ${claims.sub}, true)
    `);
    await tx.execute(sql`set local role authenticated`);
    return run(tx);
  });
}

export * from "./schema";
