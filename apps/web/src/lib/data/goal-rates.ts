import "server-only";
import { convert, DEFAULT_CURRENCY, isCurrencyCode } from "@projectb/core";
import { goalContributions } from "@projectb/db";
import { gte, sql } from "drizzle-orm";
import { getProfile, withUser } from "@/lib/auth";
import { today } from "@/lib/dates";
import type { GoalWithProgress } from "./planning";
import { getRates } from "./rates";
import { getBalancesOn, getMonthlyAverages } from "./reports";

export type GoalRate = {
  /** Typical monthly growth, or null when nothing is being saved. */
  monthly: number | null;
  source: "account" | "contributions" | "overall";
};

/**
 * How fast each goal grows in a typical month: the linked account's balance
 * change, or the contributions, over the last three months. Goals without
 * history fall back to the user's average monthly saving.
 */
export async function getGoalRates(goals: GoalWithProgress[]) {
  const day = today();
  const since = new Date(Date.parse(`${day}T00:00:00Z`) - 91 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const [balancesThen, recent, averages] = await Promise.all([
    getBalancesOn(since),
    withUser((tx) =>
      tx
        .select({
          goalId: goalContributions.goalId,
          total: sql<number>`sum(${goalContributions.amount})::bigint`.mapWith(
            Number,
          ),
        })
        .from(goalContributions)
        .where(gte(goalContributions.occurredOn, since))
        .groupBy(goalContributions.goalId),
    ),
    getMonthlyAverages(),
  ]);
  const [rateInfo, profile] = await Promise.all([getRates(), getProfile()]);
  const base = isCurrencyCode(profile.baseCurrency)
    ? profile.baseCurrency
    : DEFAULT_CURRENCY;
  // The average saving is in the main currency; goals may use another.
  const overallIn = (currency: string) =>
    averages && averages.saving > 0
      ? convert(
          averages.saving,
          base,
          isCurrencyCode(currency) ? currency : base,
          rateInfo.rates,
        )
      : null;
  return new Map(
    goals.map((goal): [string, GoalRate] => {
      // Months of history, up to three: a goal opened last week has less.
      const age = Math.min(
        3,
        Math.max(
          1,
          (Date.now() - goal.createdAt.getTime()) / (30.44 * 86_400_000),
        ),
      );
      if (goal.account) {
        // Balance change over the 91 days, if the account existed then.
        const then = balancesThen.get(goal.account.id);
        const change = then == null ? 0 : goal.account.balance - then;
        if (change > 0) {
          return [
            goal.id,
            { monthly: Math.round(change / 3), source: "account" },
          ];
        }
      } else {
        const total = recent.find((r) => r.goalId === goal.id)?.total ?? 0;
        if (total > 0) {
          return [
            goal.id,
            {
              monthly: Math.round(total / age),
              source: "contributions" as const,
            },
          ];
        }
      }
      return [
        goal.id,
        { monthly: overallIn(goal.currency), source: "overall" },
      ];
    }),
  );
}
