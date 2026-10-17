import { goalForecast } from "@projectb/core";
import { Link as LinkIcon, Plus, Target } from "lucide-react";
import { connection } from "next/server";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { GoalSummary } from "@/components/finance/goal-card";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { getGoalRates } from "@/lib/data/goal-rates";
import { type GoalWithProgress, getGoals } from "@/lib/data/planning";
import { formatDay, today } from "@/lib/dates";

export default async function GoalsPage() {
  const t = await getTranslations("Goals");
  return (
    <div className="max-w-4xl">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <Link href="/goals/new" className={buttonVariants()}>
            <Plus />
            {t("new")}
          </Link>
        }
      />
      <Suspense
        fallback={<div className="h-64 animate-pulse rounded-xl bg-muted" />}
      >
        <GoalList />
      </Suspense>
    </div>
  );
}

async function GoalList() {
  // Progress towards a target date depends on today's date.
  await connection();
  const [goals, t, locale] = await Promise.all([
    getGoals(),
    getTranslations("Goals"),
    getLocale(),
  ]);
  const rates = await getGoalRates(goals);
  const day = today();
  // When an open goal is likely reached at its current pace.
  const estimate = (goal: GoalWithProgress) => {
    if (goal.archivedAt || goal.progress.reached) return null;
    const { reachOn } = goalForecast(
      goal.progress.remaining,
      rates.get(goal.id)?.monthly ?? null,
      day,
      goal.targetDate,
    );
    return reachOn ? t("estimate", { date: formatDay(reachOn, locale) }) : null;
  };

  if (goals.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-3 px-6 py-16 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <Target className="size-5" />
        </span>
        <p className="font-medium">{t("emptyTitle")}</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          {t("emptyDescription")}
        </p>
        <Link
          href="/goals/new"
          className={buttonVariants({ className: "mt-2" })}
        >
          <Plus />
          {t("new")}
        </Link>
      </Card>
    );
  }

  const active = goals.filter((g) => !g.archivedAt);
  const archived = goals.filter((g) => g.archivedAt);
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        {active.map((goal) => (
          <GoalTile key={goal.id} goal={goal} estimate={estimate(goal)} />
        ))}
      </div>
      {archived.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">
            {t("archived")}
          </h2>
          <div className="grid gap-4 opacity-70 sm:grid-cols-2">
            {archived.map((goal) => (
              <GoalTile key={goal.id} goal={goal} estimate={null} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

async function GoalTile({
  goal,
  estimate,
}: {
  goal: GoalWithProgress;
  estimate: string | null;
}) {
  return (
    <Link
      href={`/goals/${goal.id}`}
      className="block rounded-xl border bg-card p-5 transition-colors hover:bg-muted/60"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="truncate font-medium">{goal.name}</p>
        {goal.account && (
          <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
            <LinkIcon className="size-3" />
            {goal.account.name}
          </span>
        )}
      </div>
      <GoalSummary goal={goal} />
      {estimate && (
        <p className="mt-1 text-xs text-muted-foreground">{estimate}</p>
      )}
    </Link>
  );
}
