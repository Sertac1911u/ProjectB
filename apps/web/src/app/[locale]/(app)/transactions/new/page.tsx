import type { TransactionKind } from "@projectb/core";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { TransactionEditor } from "@/components/finance/transaction-editor";
import { PageHeader } from "@/components/page-header";
import { today } from "@/lib/dates";
import { isUuid } from "@/lib/ids";

type SearchParams = PageProps<"/[locale]/transactions/new">["searchParams"];

export default async function NewTransactionPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const t = await getTranslations("Transactions");
  return (
    <div className="max-w-2xl">
      <PageHeader title={t("newTitle")} />
      <Suspense
        fallback={
          <div className="h-[32rem] animate-pulse rounded-xl bg-muted" />
        }
      >
        <NewTransaction searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function NewTransaction({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { kind, account, to, amount } = await searchParams;
  // The default date is today's, so this renders per request.
  await connection();
  return (
    <TransactionEditor
      defaults={{
        kind: (["income", "transfer"].includes(String(kind))
          ? kind
          : "expense") as TransactionKind,
        accountId: isUuid(account) ? account : null,
        // "Pay" on a card statement links here with the card and the amount.
        toAccountId: isUuid(to) ? to : null,
        amount:
          Number.isSafeInteger(Number(amount)) && Number(amount) > 0
            ? Number(amount)
            : undefined,
        occurredOn: today(),
      }}
    />
  );
}
