import { randomUUID } from "node:crypto";
import { FREQUENCIES, occurrenceDate } from "@projectb/core";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  accounts,
  asUser,
  createDb,
  recurringRules,
  tags,
  transactions,
  transactionTags,
  type Tx,
} from "./index";

// See rls.test.ts: needs a Supabase database with migrations applied.
const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("recurring transactions", () => {
  const db = createDb(url!);
  const alice = randomUUID();
  const bob = randomUUID();
  const as = <T>(user: string, run: (tx: Tx) => Promise<T>) =>
    asUser(db, { sub: user, role: "authenticated" }, run);
  const materialize = (user: string, today: string) =>
    as(user, async (tx) => {
      const [row] = await tx.execute<{ created: number }>(
        sql`select public.materialize_recurring(${today}::date) as created`,
      );
      return row!.created;
    });
  let bank: string;
  let savings: string;

  beforeAll(async () => {
    for (const id of [alice, bob]) {
      await db.execute(
        sql`insert into auth.users (id, email) values (${id}, ${`${id}@test.local`})`,
      );
    }
    [bank, savings] = (await as(alice, async (tx) =>
      (
        await tx
          .insert(accounts)
          .values([
            { name: "Banka", type: "bank", currency: "TRY" },
            { name: "Birikim", type: "savings", currency: "TRY" },
          ])
          .returning({ id: accounts.id })
      ).map((r) => r.id),
    )) as [string, string];
  });

  afterAll(async () => {
    await db.execute(
      sql`delete from auth.users where id in (${alice}, ${bob})`,
    );
    await db.$client.end();
  });

  const rule = (values: Partial<typeof recurringRules.$inferInsert>) =>
    as(alice, async (tx) => {
      const [row] = await tx
        .insert(recurringRules)
        .values({
          kind: "expense",
          accountId: bank,
          amount: 1_500_000,
          frequency: "monthly",
          startOn: "2026-08-31",
          nextOn: values.startOn ?? "2026-08-31",
          ...values,
        })
        .returning();
      return row!;
    });
  const created = (ruleId: string) =>
    as(alice, (tx) =>
      tx
        .select({ on: transactions.occurredOn, amount: transactions.amount })
        .from(transactions)
        .where(eq(transactions.recurringRuleId, ruleId))
        .orderBy(transactions.occurredOn),
    );

  it("computes the same dates in SQL as in the core package", async () => {
    const cases = FREQUENCIES.flatMap((frequency) =>
      ["2026-01-31", "2028-02-29", "2026-12-28"].flatMap((startOn) =>
        [1, 3].flatMap((interval) =>
          [0, 1, 2, 5, 13].map((k) => ({ frequency, startOn, interval, k })),
        ),
      ),
    );
    for (const c of cases) {
      const [row] = await db.execute<{ d: string }>(
        sql`select public.recurring_date(${c.startOn}::date, ${c.frequency}, ${c.interval}, ${c.k})::text as d`,
      );
      expect(row!.d, JSON.stringify(c)).toBe(occurrenceDate(c, c.k));
    }
  });

  it("creates due occurrences once, catching up on missed ones", async () => {
    const rent = await rule({ note: "Kira", tagNames: ["Ev", "kira"] });
    expect(await materialize(alice, "2026-10-17")).toBe(2);
    expect(await created(rent.id)).toEqual([
      { on: "2026-08-31", amount: 1_500_000 },
      { on: "2026-09-30", amount: 1_500_000 },
    ]);
    // Calling again, or calling for another user, creates nothing new.
    expect(await materialize(alice, "2026-10-17")).toBe(0);
    expect(await materialize(bob, "2026-12-31")).toBe(0);

    const [after] = await as(alice, (tx) =>
      tx.select().from(recurringRules).where(eq(recurringRules.id, rent.id)),
    );
    expect(after).toMatchObject({
      occurrences: 2,
      nextOn: "2026-10-31",
      finished: false,
    });

    const tagged = await as(alice, (tx) =>
      tx
        .select({ name: tags.name })
        .from(transactionTags)
        .innerJoin(tags, eq(tags.id, transactionTags.tagId))
        .innerJoin(
          transactions,
          eq(transactions.id, transactionTags.transactionId),
        )
        .where(eq(transactions.recurringRuleId, rent.id)),
    );
    expect(tagged.map((t) => t.name).sort()).toEqual([
      "Ev",
      "Ev",
      "kira",
      "kira",
    ]);
  });

  it("stops after the last occurrence or the end date", async () => {
    const loan = await rule({
      startOn: "2026-07-15",
      nextOn: "2026-07-15",
      maxOccurrences: 2,
    });
    const gym = await rule({
      startOn: "2026-09-01",
      nextOn: "2026-09-01",
      frequency: "weekly",
      endOn: "2026-09-20",
    });
    await materialize(alice, "2026-12-31");
    expect((await created(loan.id)).map((r) => r.on)).toEqual([
      "2026-07-15",
      "2026-08-15",
    ]);
    expect((await created(gym.id)).map((r) => r.on)).toEqual([
      "2026-09-01",
      "2026-09-08",
      "2026-09-15",
    ]);
    const finished = await as(alice, (tx) =>
      tx
        .select({ id: recurringRules.id, finished: recurringRules.finished })
        .from(recurringRules),
    );
    expect(
      finished
        .filter((r) => [loan.id, gym.id].includes(r.id))
        .every((r) => r.finished),
    ).toBe(true);
  });

  it("skips paused rules and creates transfers", async () => {
    const paused = await rule({
      startOn: "2026-10-01",
      nextOn: "2026-10-01",
      paused: true,
    });
    const saving = await rule({
      kind: "transfer",
      accountId: bank,
      toAccountId: savings,
      amount: 500_000,
      toAmount: 500_000,
      startOn: "2026-10-01",
      nextOn: "2026-10-01",
    });
    await materialize(alice, "2026-10-17");
    expect(await created(paused.id)).toEqual([]);
    expect(await created(saving.id)).toEqual([
      { on: "2026-10-01", amount: 500_000 },
    ]);
  });

  it("keeps the transactions of a deleted rule", async () => {
    const bonus = await rule({
      startOn: "2026-10-05",
      nextOn: "2026-10-05",
      note: "Prim",
    });
    await materialize(alice, "2026-10-17");
    await as(alice, (tx) =>
      tx.delete(recurringRules).where(eq(recurringRules.id, bonus.id)),
    );
    const kept = await as(alice, (tx) =>
      tx.select().from(transactions).where(eq(transactions.note, "Prim")),
    );
    expect(kept).toHaveLength(1);
    expect(kept[0]?.recurringRuleId).toBeNull();
  });

  it("is not available to signed-out visitors", async () => {
    const result = await db
      .transaction(async (tx) => {
        await tx.execute(sql`set local role anon`);
        return tx.execute(
          sql`select public.materialize_recurring(current_date)`,
        );
      })
      .catch((e: Error) => String(e.cause));
    expect(result).toMatch(/permission denied/);
  });
});
