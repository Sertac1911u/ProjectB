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

  it("runs as the authenticated role, scoped to the transaction", async () => {
    const [inside] = await asUser(
      db,
      { sub: alice, role: "authenticated" },
      (tx) =>
        tx.execute<{ role: string; uid: string }>(
          sql`select current_user as role, auth.uid()::text as uid`,
        ),
    );
    expect(inside).toEqual({ role: "authenticated", uid: alice });
    const [after] = await db.execute<{ role: string }>(
      sql`select current_user as role`,
    );
    expect(after?.role).toBe("postgres");
  });

  it("sets each user's claims before their queries, even when run concurrently", async () => {
    const users = Array.from({ length: 40 }, (_, i) => (i % 2 ? alice : bob));
    const seen = await Promise.all(
      users.map((sub) =>
        asUser(db, { sub, role: "authenticated" }, async (tx) => {
          const [first, second] = await Promise.all([
            tx.execute<{ role: string; uid: string }>(
              sql`select current_user as role, auth.uid()::text as uid`,
            ),
            tx.select({ id: profiles.id }).from(profiles),
          ]);
          return { ...first[0], visible: second.map((p) => p.id) };
        }),
      ),
    );
    seen.forEach((row, i) =>
      expect(row).toEqual({
        role: "authenticated",
        uid: users[i],
        visible: [users[i]],
      }),
    );
  });

  it("rolls back a failed transaction and reports the query's error", async () => {
    const error = await asUser(db, { sub: alice }, async (tx) => {
      await tx
        .update(profiles)
        .set({ displayName: "Geçici" })
        .where(eq(profiles.id, alice));
      await tx.execute(sql`select 1 / 0`);
    }).catch((e: Error) => e);
    expect(String((error as Error).cause)).toMatch(/division by zero/);
    const [row] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, alice));
    expect(row?.displayName).not.toBe("Geçici");
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
    expect(String((error as Error).cause)).toMatch(
      /permission denied|row-level security/,
    );
  });

  it("does not let users change protected columns", async () => {
    const error = await asUser(
      db,
      { sub: alice, role: "authenticated" },
      (tx) =>
        tx
          .update(profiles)
          .set({ createdAt: new Date(0) })
          .where(eq(profiles.id, alice)),
    ).catch((e: Error) => e);
    expect(String((error as Error).cause)).toMatch(/permission denied/);
  });

  it("gives signed-out visitors no access", async () => {
    const error = await db
      .transaction(async (tx) => {
        await tx.execute(sql`set local role anon`);
        return tx.select().from(profiles);
      })
      .catch((e: Error) => e);
    expect(String((error as Error).cause)).toMatch(/permission denied/);
  });
});
