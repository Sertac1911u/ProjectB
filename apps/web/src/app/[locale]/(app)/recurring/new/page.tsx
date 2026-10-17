import type { TransactionKind } from "@projectb/core";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { TransactionEditor } from "@/components/finance/transaction-editor";
import { PageHeader } from "@/components/page-header";
import { today } from "@/lib/dates";
import { isUuid } from "@/lib/ids";

type SearchParams = PageProps<"/[locale]/recurring/new">["searchParams"];

export default async function NewRecurringPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const t = await getTranslations("Recurring");
  return (
    <div className="max-w-2xl">
      <PageHeader title={t("newTitle")} />
      <Suspense
        fallback={
          <div className="h-[36rem] animate-pulse rounded-xl bg-muted" />
        }
      >
        <NewRecurring searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function NewRecurring({ searchParams }: { searchParams: SearchParams }) {
  const { kind, to, amount } = await searchParams;
  // The default start date is today's, so this renders per request.
  await connection();
  return (
    <TransactionEditor
      mode="recurring"
      defaults={{
        kind: (["income", "transfer"].includes(String(kind))
          ? kind
          : "expense") as TransactionKind,
        accountId: null,
        // A loan's "add the monthly payment" links here with the loan.
        toAccountId: isUuid(to) ? to : null,
        amount:
          Number.isSafeInteger(Number(amount)) && Number(amount) > 0
            ? Number(amount)
            : undefined,
        occurredOn: today(),
        frequency: "monthly",
      }}
    />
  );
}
