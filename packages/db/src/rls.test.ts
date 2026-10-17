import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asUser, createDb, profiles } from "./index";

// Needs a Supabase database with migrations applied, e.g. the local stack:
// TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("profiles row level security", () => {
  const db = createDb(url!);
  const alice = randomUUID();
  const bob = randomUUID();

  beforeAll(async () => {
    for (const [id, locale] of [
      [alice, "en"],
      [bob, "xx"],
    ]) {
      await db.execute(sql`
        insert into auth.users (id, email, raw_user_meta_data)
        values (${id}, ${`${id}@test.local`}, ${JSON.stringify({ locale })}::jsonb)
      `);
    }
  });

  afterAll(async () => {
    await db.execute(
      sql`delete from auth.users where id in (${alice}, ${bob})`,
    );
    await db.$client.end();
  });

  it("creates a profile on sign up with a valid locale", async () => {
    const rows = await db.select().from(profiles).where(eq(profiles.id, alice));
    expect(rows[0]?.locale).toBe("en");
    const fallback = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, bob));
    expect(fallback[0]?.locale).toBe("tr");
  });

  it("only lets users read their own profile", async () => {
    const rows = await asUser(db, { sub: alice, role: "authenticated" }, (tx) =>
      tx.select().from(profiles),
    );
    expect(rows.map((r) => r.id)).toEqual([alice]);
  });

  it("does not let users update someone else's profile", async () => {
    const updated = await asUser(
      db,
      { sub: alice, role: "authenticated" },
      (tx) =>
        tx
          .update(profiles)
          .set({ displayName: "hacked" })
          .where(eq(profiles.id, bob))
          .returning(),
    );
    expect(updated).toEqual([]);
  });

  it("does not let users insert profiles", async () => {
    const error = await asUser(
      db,
      { sub: alice, role: "authenticated" },
      (tx) => tx.insert(profiles).values({ id: randomUUID() }),
    ).catch((e: Error) => e);
    expect(String((error as Error).cause)).toMatch(/row-level security/);
  });
});
