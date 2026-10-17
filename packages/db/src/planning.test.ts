import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  accounts,
  asUser,
  budgets,
  categories,
  createDb,
  envelopes,
  goalContributions,
  goals,
  type Tx,
} from "./index";

// See rls.test.ts: needs a Supabase database with migrations applied.
const url = process.env.TEST_DATABASE_URL;

const causeOf = (e: unknown) => String((e as Error).cause ?? e);

describe.skipIf(!url)("budgets and goals", () => {
  const db = createDb(url!);
  const alice = randomUUID();
  const bob = randomUUID();
  const as = <T>(user: string, run: (tx: Tx) => Promise<T>) =>
    asUser(db, { sub: user, role: "authenticated" }, run);
  let food: string;
  let bobsFood: string;
  let savings: string;

  beforeAll(async () => {
    for (const id of [alice, bob]) {
      await db.execute(
        sql`insert into auth.users (id, email) values (${id}, ${`${id}@test.local`})`,
      );
    }
    const firstExpense = (user: string) =>
      as(user, async (tx) => {
        const [row] = await tx
          .select({ id: categories.id })
          .from(categories)
          .where(eq(categories.kind, "expense"))
          .limit(1);
        return row!.id;
      });
    food = await firstExpense(alice);
    bobsFood = await firstExpense(bob);
    savings = await as(alice, async (tx) => {
      const [row] = await tx
        .insert(accounts)
        .values({ name: "Birikim", type: "savings", currency: "TRY" })
        .returning({ id: accounts.id });
      return row!.id;
    });
  });

  afterAll(async () => {
    await db.execute(
      sql`delete from auth.users where id in (${alice}, ${bob})`,
    );
    await db.$client.end();
  });

  it("stores budget versions per month and hides them from others", async () => {
    await as(alice, (tx) =>
      tx.insert(budgets).values([
        {
          categoryId: food,
          month: "2026-09-01",
          amount: 500_000,
          currency: "TRY",
        },
        {
          categoryId: food,
          month: "2026-11-01",
          amount: null,
          currency: "TRY",
        },
      ]),
    );
    const duplicate = await as(alice, (tx) =>
      tx.insert(budgets).values({
        categoryId: food,
        month: "2026-09-01",
        amount: 1,
        currency: "TRY",
      }),
    ).catch(causeOf);
    expect(duplicate).toMatch(/duplicate key/);
    expect(await as(bob, (tx) => tx.select().from(budgets))).toEqual([]);
  });

  it("rejects malformed budgets and other users' categories", async () => {
    const attempts = [
      { categoryId: food, month: "2026-10-15", amount: 100, currency: "TRY" },
      { categoryId: food, month: "2026-10-01", amount: 0, currency: "TRY" },
      { categoryId: food, month: "2026-10-01", amount: 100, currency: "XYZ" },
    ];
    for (const values of attempts) {
      const result = await as(alice, (tx) =>
        tx.insert(budgets).values(values),
      ).catch(causeOf);
      expect(result, JSON.stringify(values)).toMatch(
        /violates check constraint/,
      );
    }
    const foreign = await as(alice, (tx) =>
      tx.insert(budgets).values({
        categoryId: bobsFood,
        month: "2026-10-01",
        amount: 100,
        currency: "TRY",
      }),
    ).catch(causeOf);
    expect(foreign).toMatch(/violates foreign key constraint/);
  });

  it("keeps a goal when its account is deleted and removes contributions with the goal", async () => {
    const [linked, manual] = await as(alice, (tx) =>
      tx
        .insert(goals)
        .values([
          {
            name: "Ev",
            targetAmount: 100_000_000,
            currency: "TRY",
            accountId: savings,
          },
          { name: "Tatil", targetAmount: 3_000_000, currency: "TRY" },
        ])
        .returning({ id: goals.id }),
    );
    await as(alice, (tx) =>
      tx.insert(goalContributions).values([
        { goalId: manual!.id, amount: 500_000, occurredOn: "2026-10-01" },
        { goalId: manual!.id, amount: -100_000, occurredOn: "2026-10-10" },
      ]),
    );
    const zero = await as(alice, (tx) =>
      tx
        .insert(goalContributions)
        .values({ goalId: manual!.id, amount: 0, occurredOn: "2026-10-01" }),
    ).catch(causeOf);
    expect(zero).toMatch(/violates check constraint/);
    const intoBobs = await as(bob, (tx) =>
      tx
        .insert(goalContributions)
        .values({ goalId: manual!.id, amount: 1, occurredOn: "2026-10-01" }),
    ).catch(causeOf);
    expect(intoBobs).toMatch(/violates foreign key constraint/);

    await as(alice, (tx) =>
      tx.delete(accounts).where(eq(accounts.id, savings)),
    );
    const [after] = await as(alice, (tx) =>
      tx.select().from(goals).where(eq(goals.id, linked!.id)),
    );
    expect(after).toMatchObject({ name: "Ev", accountId: null, userId: alice });

    await as(alice, (tx) => tx.delete(goals).where(eq(goals.id, manual!.id)));
    expect(
      await as(alice, (tx) => tx.select().from(goalContributions)),
    ).toEqual([]);
  });

  it("keeps envelopes private and their dates and repeats valid", async () => {
    await as(alice, (tx) =>
      tx.insert(envelopes).values({
        name: "Kasko",
        amount: 1_200_000,
        currency: "TRY",
        startOn: "2026-10-17",
        dueOn: "2027-04-17",
        intervalMonths: 12,
      }),
    );
    expect(await as(bob, (tx) => tx.select().from(envelopes))).toEqual([]);
    const attempts = [
      { startOn: "2026-10-17", dueOn: "2026-10-01", intervalMonths: null },
      { startOn: "2026-10-17", dueOn: "2027-01-01", intervalMonths: 0 },
      { startOn: "2026-10-17", dueOn: "2027-01-01", intervalMonths: 61 },
    ];
    for (const values of attempts) {
      const result = await as(alice, (tx) =>
        tx
          .insert(envelopes)
          .values({ name: "X", amount: 100, currency: "TRY", ...values }),
      ).catch(causeOf);
      expect(result, JSON.stringify(values)).toMatch(
        /violates check constraint/,
      );
    }
  });
});
