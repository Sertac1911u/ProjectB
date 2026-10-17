import { randomUUID } from "node:crypto";
import { DEFAULT_CATEGORIES } from "@projectb/core";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  accounts,
  asUser,
  categories,
  createDb,
  envelopes,
  goals,
  profiles,
  transactions,
  type Tx,
} from "./index";

// See rls.test.ts: needs a Supabase database with migrations applied.
const url = process.env.TEST_DATABASE_URL;

const defaultCount = Object.values(DEFAULT_CATEGORIES).reduce(
  (sum, parents) =>
    sum +
    Object.values(parents).reduce((n, children) => n + 1 + children.length, 0),
  0,
);

describe.skipIf(!url)("resetting data and deleting the account", () => {
  const db = createDb(url!);
  const alice = randomUUID();
  const bob = randomUUID();
  const as = <T>(user: string, run: (tx: Tx) => Promise<T>) =>
    asUser(db, { sub: user, role: "authenticated" }, run);

  const fill = (user: string) =>
    as(user, async (tx) => {
      const [bank] = await tx
        .insert(accounts)
        .values({ name: "Banka", type: "bank", currency: "TRY" })
        .returning({ id: accounts.id });
      await tx.insert(transactions).values({
        kind: "expense",
        accountId: bank!.id,
        amount: 100,
        occurredOn: "2026-10-01",
      });
      await tx
        .insert(goals)
        .values({ name: "Tatil", targetAmount: 1_000, currency: "TRY" });
      await tx.insert(envelopes).values({
        name: "Kasko",
        amount: 1_000,
        currency: "TRY",
        startOn: "2026-10-01",
        dueOn: "2027-01-01",
      });
      await tx
        .insert(categories)
        .values({ kind: "expense", name: "Özel kategori" });
      await tx
        .update(profiles)
        .set({ uiMode: "simple", displayName: "Ali" })
        .where(eq(profiles.id, user));
    });

  beforeAll(async () => {
    for (const id of [alice, bob]) {
      await db.execute(
        sql`insert into auth.users (id, email) values (${id}, ${`${id}@test.local`})`,
      );
      await fill(id);
    }
  });

  afterAll(async () => {
    await db.execute(
      sql`delete from auth.users where id in (${alice}, ${bob})`,
    );
    await db.$client.end();
  });

  it("starts the user over and leaves others alone", async () => {
    await as(alice, (tx) => tx.execute(sql`select public.reset_own_data()`));
    const counts = (user: string) =>
      as(user, async (tx) => ({
        accounts: (await tx.select().from(accounts)).length,
        transactions: (await tx.select().from(transactions)).length,
        goals: (await tx.select().from(goals)).length,
        envelopes: (await tx.select().from(envelopes)).length,
        categories: (await tx.select().from(categories)).length,
        profile: (
          await tx
            .select({ uiMode: profiles.uiMode, name: profiles.displayName })
            .from(profiles)
        )[0],
      }));
    expect(await counts(alice)).toEqual({
      accounts: 0,
      transactions: 0,
      goals: 0,
      envelopes: 0,
      categories: defaultCount,
      profile: { uiMode: null, name: "Ali" },
    });
    expect(await counts(bob)).toMatchObject({
      accounts: 1,
      transactions: 1,
      goals: 1,
      envelopes: 1,
      categories: defaultCount + 1,
    });
  });

  it("deletes only the signed-in user with all their data", async () => {
    await as(bob, (tx) => tx.execute(sql`select public.delete_own_account()`));
    const users = await db.execute<{ id: string }>(
      sql`select id from auth.users where id in (${alice}, ${bob})`,
    );
    expect(users.map((u) => u.id)).toEqual([alice]);
    const left = await db.execute<{ n: number }>(
      sql`select count(*)::int as n from public.accounts where user_id = ${bob}`,
    );
    expect(left[0]!.n).toBe(0);
  });
});
