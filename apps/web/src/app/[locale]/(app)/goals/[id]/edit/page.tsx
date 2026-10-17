import type { Locale } from "@projectb/core";
import { Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { GoalForm } from "@/components/finance/goal-form";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { ConfirmSubmit } from "@/components/ui/confirm-submit";
import { SubmitButton } from "@/components/ui/submit-button";
import { deleteGoal, setGoalArchived } from "@/lib/actions/planning";
import { goalAccounts, getGoals } from "@/lib/data/planning";
import { isUuid } from "@/lib/ids";

type Params = PageProps<"/[locale]/goals/[id]/edit">["params"];

export default async function EditGoalPage({ params }: { params: Params }) {
  const t = await getTranslations("Goals");
  return (
    <div className="max-w-2xl">
      <PageHeader title={t("editTitle")} />
      <Suspense
        fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}
      >
        <EditGoal params={params} />
      </Suspense>
    </div>
  );
}

async function EditGoal({ params }: { params: Params }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  await connection();
  const [goals, locale, t, tCommon] = await Promise.all([
    getGoals(),
    getLocale() as Promise<Locale>,
    getTranslations("Goals"),
    getTranslations("Common"),
  ]);
  const goal = goals.find((g) => g.id === id);
  if (!goal) notFound();
  const accounts = await goalAccounts(goal.accountId);
  const archived = Boolean(goal.archivedAt);

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-6">
        <GoalForm
          goal={{
            id: goal.id,
            name: goal.name,
            targetAmount: goal.targetAmount,
            currency: goal.currency,
            targetDate: goal.targetDate,
            accountId: goal.accountId,
          }}
          accounts={accounts}
          defaultCurrency={goal.currency}
        />
      </Card>
      <Card className="flex flex-col gap-3 p-6">
        <div className="flex flex-wrap gap-2">
          <form action={setGoalArchived.bind(null, locale, goal.id, !archived)}>
            <SubmitButton variant="outline">
              {archived ? <ArchiveRestore /> : <Archive />}
              {archived ? tCommon("restore") : tCommon("archive")}
            </SubmitButton>
          </form>
          <form action={deleteGoal.bind(null, locale, goal.id)}>
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
          {t("archiveHint")} {t("deleteHint")}
        </p>
      </Card>
    </div>
  );
}
