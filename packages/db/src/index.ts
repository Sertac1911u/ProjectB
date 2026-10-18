import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export function createDb(databaseUrl: string) {
  // Prepared statements save a round trip per query once a connection has
  // run it. Supabase's transaction pooler (port 6543) does not support them;
  // its session pooler and direct connections do.
  const client = postgres(databaseUrl, {
    prepare: !/:6543\//.test(databaseUrl),
  });
  return drizzle(client, { schema });
}

export type Db = ReturnType<typeof createDb>;
/** What queries run on inside `asUser`; a plain transaction works too. */
export type Tx = Omit<Db, "$client">;

/** The verified JWT claims of the signed-in user. */
export type JwtClaims = { sub: string; role?: string } & Record<
  string,
  unknown
>;

/**
 * Runs queries as the signed-in user, so Postgres row level security applies
 * exactly as it does for the mobile app talking to Supabase directly.
 */
export async function asUser<T>(
  db: Db,
  claims: JwtClaims,
  run: (tx: Tx) => Promise<T>,
): Promise<T> {
  const connection = await db.$client.reserve();
  try {
    // Sent without waiting for their replies, ahead of the first query on
    // this connection, so a transaction costs one round trip per query plus
    // one to commit. The claims for auth.uid() and the role are both scoped
    // to the transaction (`set_config('role', ..., true)` is SET LOCAL ROLE).
    const setup = Promise.all([
      connection`begin`.execute(),
      connection`
        select
          set_config('request.jwt.claims', ${JSON.stringify(claims)}, true),
          set_config('request.jwt.claim.sub', ${claims.sub}, true),
          set_config('role', 'authenticated', true)
      `.execute(),
    ]);
    setup.catch(() => {});
    try {
      // drizzle reads the parsers from the client; they are the pool's.
      const tx = drizzle(
        Object.assign(connection, { options: db.$client.options }),
        { schema },
      );
      const result = await run(tx);
      await setup;
      await connection`commit`;
      return result;
    } catch (error) {
      await connection`rollback`.catch(() => {});
      // A failed setup aborts every query after it, so its error is the cause.
      throw await setup.then(
        () => error,
        (setupError: unknown) => setupError,
      );
    }
  } finally {
    connection.release();
  }
}

export * from "./queries";
export * from "./schema";
