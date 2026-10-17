import { randomUUID } from "node:crypto";
import { DEFAULT_CATEGORIES } from "@projectb/core";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  accountBalances,
  accounts,
  asUser,
  categories,
  createDb,
  setTransactionTags,
  tags,
  transactions,
  transactionTags,
  type Tx,
} from "./index";

// See rls.test.ts: needs a Supabase database with migrations applied.
const url = process.env.TEST_DATABASE_URL;

const causeOf = (e: unknown) => String((e as Error).cause ?? e);

describe.skipIf(!url)("finance tables", () => {
  const db = createDb(url!);
  const alice = randomUUID();
  const bob = randomUUID();
  const as = <T>(user: string, run: (tx: Tx) => Promise<T>) =>
    asUser(db, { sub: user, role: "authenticated" }, run);

  let aliceCash: string;
  let aliceBank: string;
  let bobAccount: string;
  let bobCategory: string;

  beforeAll(async () => {
    for (const id of [alice, bob]) {
      await db.execute(sql`
        insert into auth.users (id, email) values (${id}, ${`${id}@test.local`})
      `);
    }
    [aliceCash, aliceBank] = (await as(alice, async (tx) =>
      (
        await tx
          .insert(accounts)
          .values([
            {
              name: "Cüzdan",
              type: "cash",
              currency: "TRY",
              openingBalance: 10_000,
            },
            { name: "Banka", type: "bank", currency: "TRY" },
          ])
          .returning({ id: accounts.id })
      ).map((r) => r.id),
    )) as [string, string];
    bobAccount = await as(bob, async (tx) => {
      const [row] = await tx
        .insert(accounts)
        .values({ name: "Bob", type: "bank", currency: "USD" })
        .returning({ id: accounts.id });
      return row!.id;
    });
    bobCategory = await as(bob, async (tx) => {
      const [row] = await tx
        .select({ id: categories.id })
        .from(categories)
        .where(eq(categories.systemKey, "groceries"));
      return row!.id;
    });
  });

  afterAll(async () => {
    await db.execute(
      sql`delete from auth.users where id in (${alice}, ${bob})`,
    );
    await db.$client.end();
  });

  it("gives every new user the default categories", async () => {
    const rows = await as(alice, (tx) => tx.select().from(categories));
    const expected = Object.values(DEFAULT_CATEGORIES).flatMap((parents) =>
      Object.entries(parents).flatMap(([parent, children]) => [
        parent,
        ...children,
      ]),
    );
    expect(rows.map((r) => r.systemKey).sort()).toEqual(expected.sort());
    const fuel = rows.find((r) => r.systemKey === "fuel");
    const transport = rows.find((r) => r.systemKey === "transport");
    expect(fuel?.parentId).toBe(transport?.id);
  });

  it("fills in the owner automatically and hides other users' rows", async () => {
    const [account] = await as(alice, (tx) =>
      tx.select().from(accounts).where(eq(accounts.id, aliceCash)),
    );
    expect(account?.userId).toBe(alice);
    const visible = await as(alice, (tx) => tx.select().from(accounts));
    expect(visible.map((a) => a.id).sort()).toEqual(
      [aliceCash, aliceBank].sort(),
    );
  });

  it("refuses references to another user's account or category", async () => {
    const withBobsAccount = await as(alice, (tx) =>
      tx.insert(transactions).values({
        kind: "expense",
        accountId: bobAccount,
        amount: 100,
        occurredOn: "2026-10-01",
      }),
    ).catch(causeOf);
    expect(withBobsAccount).toMatch(/violates foreign key constraint/);

    const withBobsCategory = await as(alice, (tx) =>
      tx.insert(transactions).values({
        kind: "expense",
        accountId: aliceCash,
        categoryId: bobCategory,
        amount: 100,
        occurredOn: "2026-10-01",
      }),
    ).catch(causeOf);
    expect(withBobsCategory).toMatch(/violates foreign key constraint/);
  });

  it("rejects malformed transactions", async () => {
    const attempts = [
      { kind: "expense", accountId: aliceCash, amount: 0 },
      { kind: "transfer", accountId: aliceCash, amount: 100 },
      {
        kind: "transfer",
        accountId: aliceCash,
        toAccountId: aliceBank,
        amount: 100,
      },
      {
        kind: "transfer",
        accountId: aliceCash,
        toAccountId: aliceCash,
        amount: 1,
        toAmount: 1,
      },
      {
        kind: "income",
        accountId: aliceCash,
        toAccountId: aliceBank,
        amount: 1,
        toAmount: 1,
      },
    ];
    for (const values of attempts) {
      const result = await as(alice, (tx) =>
        tx.insert(transactions).values({ ...values, occurredOn: "2026-10-01" }),
      ).catch(causeOf);
      expect(result, JSON.stringify(values)).toMatch(
        /violates check constraint/,
      );
    }
  });

  it("computes balances from opening balance, income, expenses and transfers", async () => {
    await as(alice, (tx) =>
      tx.insert(transactions).values([
        {
          kind: "income",
          accountId: aliceBank,
          amount: 50_000,
          occurredOn: "2026-10-01",
        },
        {
          kind: "expense",
          accountId: aliceCash,
          amount: 2_500,
          occurredOn: "2026-10-02",
        },
        {
          kind: "transfer",
          accountId: aliceBank,
          toAccountId: aliceCash,
          amount: 20_000,
          toAmount: 20_000,
          occurredOn: "2026-10-03",
        },
      ]),
    );
    const balances = await as(alice, (tx) => tx.select().from(accountBalances));
    const byId = Object.fromEntries(
      balances.map((b) => [b.accountId, b.balance]),
    );
    expect(byId).toEqual({ [aliceCash]: 27_500, [aliceBank]: 30_000 });

    const bobSees = await as(bob, (tx) => tx.select().from(accountBalances));
    expect(bobSees.map((b) => b.accountId)).toEqual([bobAccount]);
  });

  it("keeps tag names unique per user regardless of case", async () => {
    await as(alice, (tx) => tx.insert(tags).values({ name: "Tatil" }));
    const duplicate = await as(alice, (tx) =>
      tx.insert(tags).values({ name: "tatil" }),
    ).catch(causeOf);
    expect(duplicate).toMatch(/duplicate key/);
    // Another user may use the same name.
    await as(bob, (tx) => tx.insert(tags).values({ name: "Tatil" }));
  });

  it("does not let users tag another user's transaction", async () => {
    const [bobTx] = await as(bob, (tx) =>
      tx
        .insert(transactions)
        .values({
          kind: "expense",
          accountId: bobAccount,
          amount: 1,
          occurredOn: "2026-10-01",
        })
        .returning({ id: transactions.id }),
    );
    const [aliceTag] = await as(alice, (tx) =>
      tx.select({ id: tags.id }).from(tags).where(eq(tags.name, "Tatil")),
    );
    const result = await as(alice, (tx) =>
      tx
        .insert(transactionTags)
        .values({ transactionId: bobTx!.id, tagId: aliceTag!.id }),
    ).catch(causeOf);
    expect(result).toMatch(/violates foreign key constraint/);
  });

  it("gives signed-out visitors no access to finance data", async () => {
    for (const table of [
      "accounts",
      "transactions",
      "categories",
      "account_balances",
    ]) {
      const result = await db
        .transaction(async (tx) => {
          await tx.execute(sql`set local role anon`);
          return tx.execute(sql`select * from ${sql.identifier(table)}`);
        })
        .catch(causeOf);
      expect(result, table).toMatch(/permission denied/);
    }
  });

  it("sets a transaction's tags exactly, reusing existing ones regardless of case", async () => {
    const tagsOf = (id: string) =>
      as(alice, async (tx) =>
        (
          await tx
            .select({ name: tags.name })
            .from(transactionTags)
            .innerJoin(tags, eq(tags.id, transactionTags.tagId))
            .where(eq(transactionTags.transactionId, id))
        )
          .map((r) => r.name)
          .sort(),
      );
    const [row] = await as(alice, (tx) =>
      tx
        .insert(transactions)
        .values({
          kind: "expense",
          accountId: aliceCash,
          amount: 1,
          occurredOn: "2026-10-05",
        })
        .returning({ id: transactions.id }),
    );
    const id = row!.id;

    await as(alice, (tx) => setTransactionTags(tx, id, ["Ev", "market"]));
    expect(await tagsOf(id)).toEqual(["Ev", "market"]);

    // "ev" matches the existing "Ev"; "market" is dropped; "yeni" is created.
    await as(alice, (tx) => setTransactionTags(tx, id, ["ev", "yeni"]));
    expect(await tagsOf(id)).toEqual(["Ev", "yeni"]);

    await as(alice, (tx) => setTransactionTags(tx, id, []));
    expect(await tagsOf(id)).toEqual([]);

    const names = await as(alice, async (tx) =>
      (await tx.select({ name: tags.name }).from(tags))
        .map((r) => r.name)
        .sort(),
    );
    expect(
      names.filter((n) => ["Ev", "ev", "market", "yeni"].includes(n)),
    ).toEqual(["Ev", "market", "yeni"]);
  });
});
