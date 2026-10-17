import type { Locale, TransactionKind } from "@projectb/core";
import { Trash2 } from "lucide-react";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { TransactionEditor } from "@/components/finance/transaction-editor";
import { PageHeader } from "@/components/page-header";
import { ConfirmSubmit } from "@/components/ui/confirm-submit";
import { deleteTransaction } from "@/lib/actions/finance";
import { getTransaction } from "@/lib/data/finance";
import { isUuid } from "@/lib/ids";

type Params = PageProps<"/[locale]/transactions/[id]">["params"];

export default async function EditTransactionPage({
  params,
}: {
  params: Params;
}) {
  const t = await getTranslations("Transactions");
  return (
    <div className="max-w-2xl">
      <PageHeader title={t("editTitle")} />
      <Suspense
        fallback={
          <div className="h-[32rem] animate-pulse rounded-xl bg-muted" />
        }
      >
        <EditTransaction params={params} />
      </Suspense>
    </div>
  );
}

async function EditTransaction({ params }: { params: Params }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [transaction, locale, tCommon] = await Promise.all([
    getTransaction(id),
    getLocale() as Promise<Locale>,
    getTranslations("Common"),
  ]);
  if (!transaction) notFound();

  return (
    <div className="flex flex-col gap-4">
      <TransactionEditor
        transactionId={transaction.id}
        defaults={{ ...transaction, kind: transaction.kind as TransactionKind }}
      />
      <form action={deleteTransaction.bind(null, locale, transaction.id)}>
        <ConfirmSubmit variant="destructive" message={tCommon("confirmDelete")}>
          <Trash2 />
          {tCommon("delete")}
        </ConfirmSubmit>
      </form>
    </div>
  );
}
