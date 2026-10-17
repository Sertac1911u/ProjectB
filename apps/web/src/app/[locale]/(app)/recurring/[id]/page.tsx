import type { Frequency, Locale, TransactionKind } from "@projectb/core";
import { Pause, Play, Trash2 } from "lucide-react";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { TransactionEditor } from "@/components/finance/transaction-editor";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { ConfirmSubmit } from "@/components/ui/confirm-submit";
import { SubmitButton } from "@/components/ui/submit-button";
import { deleteRecurring, setRecurringPaused } from "@/lib/actions/recurring";
import { getRecurringRules } from "@/lib/data/recurring";
import { isUuid } from "@/lib/ids";

type Params = PageProps<"/[locale]/recurring/[id]">["params"];

export default async function EditRecurringPage({
  params,
}: {
  params: Params;
}) {
  const t = await getTranslations("Recurring");
  return (
    <div className="max-w-2xl">
      <PageHeader title={t("editTitle")} />
      <Suspense
        fallback={
          <div className="h-[36rem] animate-pulse rounded-xl bg-muted" />
        }
      >
        <EditRecurring params={params} />
      </Suspense>
    </div>
  );
}

async function EditRecurring({ params }: { params: Params }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [rules, locale, t, tCommon] = await Promise.all([
    getRecurringRules(),
    getLocale() as Promise<Locale>,
    getTranslations("Recurring"),
    getTranslations("Common"),
  ]);
  const rule = rules.find((r) => r.id === id);
  if (!rule) notFound();

  return (
    <div className="flex flex-col gap-4">
      <TransactionEditor
        mode="recurring"
        recurringId={rule.id}
        defaults={{
          kind: rule.kind as TransactionKind,
          accountId: rule.accountId,
          toAccountId: rule.toAccountId,
          categoryId: rule.categoryId,
          amount: rule.amount,
          toAmount: rule.toAmount,
          occurredOn: rule.startOn,
          note: rule.note,
          tags: rule.tagNames,
          frequency: rule.frequency as Frequency,
          interval: rule.intervalCount,
          endOn: rule.endOn,
          maxOccurrences: rule.maxOccurrences,
        }}
      />
      <Card className="flex flex-col gap-3 p-6">
        <div className="flex flex-wrap gap-2">
          {!rule.finished && (
            <form
              action={setRecurringPaused.bind(
                null,
                locale,
                rule.id,
                !rule.paused,
              )}
            >
              <SubmitButton variant="outline">
                {rule.paused ? <Play /> : <Pause />}
                {rule.paused ? t("resume") : t("pause")}
              </SubmitButton>
            </form>
          )}
          <form action={deleteRecurring.bind(null, locale, rule.id)}>
            <ConfirmSubmit
              variant="destructive"
              message={tCommon("confirmDelete")}
            >
              <Trash2 />
              {tCommon("delete")}
            </ConfirmSubmit>
          </form>
        </div>
        <p className="text-sm text-muted-foreground">
          {rule.paused ? t("resumeHint") : t("deleteHint")}
        </p>
      </Card>
    </div>
  );
}
