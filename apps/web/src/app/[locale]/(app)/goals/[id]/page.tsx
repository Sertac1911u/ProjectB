import type { Locale } from "@projectb/core";
import { ArrowLeftRight, Pencil, Trash2 } from "lucide-react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Amount } from "@/components/finance/amount";
import { ContributionForm } from "@/components/finance/contribution-form";
import { GoalSummary } from "@/components/finance/goal-card";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { Link } from "@/i18n/navigation";
import { deleteContribution } from "@/lib/actions/planning";
import { getGoalContributions, getGoals } from "@/lib/data/planning";
import { formatDay, today } from "@/lib/dates";
import { isUuid } from "@/lib/ids";

type Params = PageProps<"/[locale]/goals/[id]">["params"];

export default function GoalPage({ params }: { params: Params }) {
  return (
    <div className="max-w-3xl">
      <Suspense
        fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}
      >
        <Goal params={params} />
      </Suspense>
    </div>
  );
}

async function Goal({ params }: { params: Params }) {
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

  return (
    <>
      <PageHeader
        title={goal.name}
        description={
          goal.targetDate
            ? t("due", { date: formatDay(goal.targetDate, locale) })
            : undefined
        }
        actions={
          <Link
            href={`/goals/${goal.id}/edit`}
            className={buttonVariants({ variant: "outline" })}
          >
            <Pencil />
            {tCommon("edit")}
          </Link>
        }
      />
      <div className="flex flex-col gap-4">
        <Card className="p-6">
          <GoalSummary goal={goal} size="large" />
        </Card>
        {goal.account ? (
          <Card className="flex flex-col gap-3 p-6">
            <p className="text-sm text-muted-foreground">
              {t("tracksAccount", { account: goal.account.name })}
            </p>
            {!goal.progress.reached && (
              <div>
                <Link
                  href={{
                    pathname: "/transactions/new",
                    query: {
                      kind: "transfer",
                      to: goal.account.id,
                      amount: goal.progress.monthlyNeeded ?? undefined,
                    },
                  }}
                  className={buttonVariants()}
                >
                  <ArrowLeftRight />
                  {t("transfer")}
                </Link>
              </div>
            )}
          </Card>
        ) : (
          <Contributions
            goalId={goal.id}
            currency={goal.currency}
            archived={Boolean(goal.archivedAt)}
            locale={locale}
          />
        )}
      </div>
    </>
  );
}

async function Contributions({
  goalId,
  currency,
  archived,
  locale,
}: {
  goalId: string;
  currency: Parameters<typeof ContributionForm>[0]["currency"];
  archived: boolean;
  locale: Locale;
}) {
  const [rows, t, tCommon] = await Promise.all([
    getGoalContributions(goalId),
    getTranslations("Goals"),
    getTranslations("Common"),
  ]);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("contributions")}</CardTitle>
        {rows.length === 0 && (
          <CardDescription>{t("noContributions")}</CardDescription>
        )}
      </CardHeader>
      {!archived && (
        <div className="px-6 pb-6">
          <ContributionForm
            goalId={goalId}
            currency={currency}
            today={today()}
          />
        </div>
      )}
      {rows.length > 0 && (
        <ul className="divide-y border-t">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex items-center justify-between gap-3 px-6 py-3 text-sm"
            >
              <span className="min-w-0">
                <span className="block truncate">
                  {row.note ||
                    (row.amount < 0 ? t("withdrawEntry") : t("depositEntry"))}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDay(row.occurredOn, locale, "medium")}
                </span>
              </span>
              <span className="flex items-center gap-2">
                <Amount
                  value={Math.abs(row.amount)}
                  currency={currency}
                  locale={locale}
                  kind={row.amount < 0 ? "expense" : "income"}
                />
                <form
                  action={deleteContribution.bind(null, locale, goalId, row.id)}
                >
                  <SubmitButton
                    variant="ghost"
                    size="icon"
                    aria-label={tCommon("delete")}
                  >
                    <Trash2 />
                  </SubmitButton>
                </form>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
