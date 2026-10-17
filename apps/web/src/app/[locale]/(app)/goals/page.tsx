import { Link as LinkIcon, Plus, Target } from "lucide-react";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { GoalSummary } from "@/components/finance/goal-card";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { type GoalWithProgress, getGoals } from "@/lib/data/planning";

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
  const [goals, t] = await Promise.all([getGoals(), getTranslations("Goals")]);

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
          <GoalTile key={goal.id} goal={goal} />
        ))}
      </div>
      {archived.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">
            {t("archived")}
          </h2>
          <div className="grid gap-4 opacity-70 sm:grid-cols-2">
            {archived.map((goal) => (
              <GoalTile key={goal.id} goal={goal} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

async function GoalTile({ goal }: { goal: GoalWithProgress }) {
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
    </Link>
  );
}
