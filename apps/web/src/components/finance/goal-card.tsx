import { formatMoney } from "@projectb/core";
import { getLocale, getTranslations } from "next-intl/server";
import { Amount } from "@/components/finance/amount";
import { Progress } from "@/components/ui/progress";
import type { GoalWithProgress } from "@/lib/data/planning";
import { formatDay } from "@/lib/dates";
import { cn } from "@/lib/utils";

/** Progress of one goal: amounts, bar and what it takes to finish on time. */
export async function GoalSummary({
  goal,
  size = "default",
}: {
  goal: GoalWithProgress;
  size?: "default" | "large";
}) {
  const [locale, t] = await Promise.all([
    getLocale(),
    getTranslations("Goals"),
  ]);
  const { progress } = goal;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <p className="text-sm tabular-nums">
          <Amount
            value={progress.saved}
            currency={goal.currency}
            locale={locale}
            className={cn(
              "font-semibold",
              size === "large" ? "text-2xl" : "text-base",
            )}
          />
          <span className="text-muted-foreground">
            {" / "}
            <Amount
              value={goal.targetAmount}
              currency={goal.currency}
              locale={locale}
            />
          </span>
        </p>
        <span className="text-sm font-medium text-muted-foreground">
          {t("percent", { percent: Math.floor(progress.percent) })}
        </span>
      </div>
      <Progress value={progress.percent} label={goal.name} />
      <p
        className={cn(
          "text-xs",
          progress.reached
            ? "font-medium text-accent-foreground"
            : progress.overdue
              ? "text-destructive"
              : "text-muted-foreground",
        )}
      >
        {progress.reached
          ? t("reached")
          : progress.overdue
            ? t("overdue")
            : progress.monthlyNeeded !== null && goal.targetDate
              ? t("monthlyNeeded", {
                  amount: formatMoney(
                    progress.monthlyNeeded,
                    goal.currency,
                    locale,
                  ),
                  date: formatDay(goal.targetDate, locale),
                })
              : `${t("remaining")}: ${formatMoney(progress.remaining, goal.currency, locale)}`}
      </p>
    </div>
  );
}
