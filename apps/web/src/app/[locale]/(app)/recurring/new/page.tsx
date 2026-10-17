import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { TransactionEditor } from "@/components/finance/transaction-editor";
import { PageHeader } from "@/components/page-header";
import { today } from "@/lib/dates";

export default async function NewRecurringPage() {
  const t = await getTranslations("Recurring");
  return (
    <div className="max-w-2xl">
      <PageHeader title={t("newTitle")} />
      <Suspense
        fallback={
          <div className="h-[36rem] animate-pulse rounded-xl bg-muted" />
        }
      >
        <NewRecurring />
      </Suspense>
    </div>
  );
}

async function NewRecurring() {
  // The default start date is today's, so this renders per request.
  await connection();
  return (
    <TransactionEditor
      mode="recurring"
      defaults={{
        kind: "expense",
        accountId: null,
        occurredOn: today(),
        frequency: "monthly",
      }}
    />
  );
}
