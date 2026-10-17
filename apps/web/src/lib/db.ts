import "server-only";
import { createDb, type Db } from "@projectb/db";

const globalForDb = globalThis as { db?: Db };

/** Reuses one connection pool across hot reloads in development. */
export function getDb(): Db {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set in apps/web/.env.local");
  }
  return (globalForDb.db ??= createDb(url));
}
