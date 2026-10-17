import { formatMoney, type ResilienceLevel } from "@projectb/core";
import { ShieldCheck } from "lucide-react";
import { connection } from "next/server";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { categoryPath } from "@/lib/categories";
import { getCategories } from "@/lib/data/finance";
import { getResilience } from "@/lib/data/resilience";
import { cn } from "@/lib/utils";

const TONE: Record<ResilienceLevel, "danger" | "warning" | "default"> = {
  weak: "danger",
  building: "warning",
  good: "default",
  strong: "default",
};

export default async function ResiliencePage() {
  const t = await getTranslations("Resilience");
  return (
    <div className="max-w-3xl">
      <PageHeader title={t("title")} description={t("description")} />
      <Suspense
        fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}
      >
        <ResilienceDetails />
      </Suspense>
    </div>
  );
}

async function ResilienceDetails() {
  // Upcoming payments are counted from today.
  await connection();
  const [r, categories, locale, t, tCategories] = await Promise.all([
    getResilience(),
    getCategories(),
    getLocale(),
    getTranslations("Resilience"),
    getTranslations("Categories"),
  ]);
  const money = (v: number) => formatMoney(v, r.currency, locale);
  const months = (v: number) =>
    t("months", {
      value: new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(
        v,
      ),
    });
  const { change } = r;

  const reasons = [
    t("reasonReserve", { amount: money(r.reserve) }),
    r.cardDebt > 0 && t("reasonCardDebt", { amount: money(r.cardDebt) }),
    r.averages &&
      t("reasonSpending", {
        count: r.averages.months,
        amount: money(r.averages.expense),
      }),
    r.loanMonthly > 0 && t("reasonLoans", { amount: money(r.loanMonthly) }),
    r.averages &&
      (r.averages.saving >= 0
        ? t("reasonSaving", { amount: money(r.averages.saving) })
        : t("reasonLosing", { amount: money(-r.averages.saving) })),
    r.essentialMonths !== null &&
      t("reasonEssential", {
        amount: money(r.essentialMonthly),
        months: months(r.essentialMonths),
      }),
    change !== null &&
      change !== 0 &&
      (change > 0
        ? t("reasonUp", { amount: money(change) })
        : t("reasonDown", { amount: money(-change) })),
    t("afterUpcoming", { amount: money(r.afterUpcoming) }),
  ].filter(Boolean) as string[];

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-4 p-6">
        {r.months === null ? (
          <p className="text-sm text-muted-foreground">{t("noData")}</p>
        ) : (
          <>
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                <ShieldCheck className="size-5" />
              </span>
              <div className="flex flex-col gap-1">
                <p
                  className={cn(
                    "text-sm font-medium",
                    r.level === "weak"
                      ? "text-destructive"
                      : r.level === "building"
                        ? "text-warning-foreground"
                        : "text-accent-foreground",
                  )}
                >
                  {t(`levels.${r.level}`)}
                </p>
                <p className="text-2xl font-semibold tracking-tight">
                  {t("headline", { months: months(r.months) })}
                </p>
              </div>
            </div>
            <Progress
              value={(Math.min(r.months, 6) / 6) * 100}
              label={t("title")}
              tone={TONE[r.level]}
            />
            <p className="text-sm text-muted-foreground">
              {t(`levelHints.${r.level}`)}
            </p>
          </>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("why")}</CardTitle>
        </CardHeader>
        <ul className="flex flex-col gap-2 px-6 pb-6 text-sm">
          {reasons.map((reason) => (
            <li key={reason} className="flex gap-2">
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-muted-foreground" />
              {reason}
            </li>
          ))}
        </ul>
      </Card>

      <section>
        <h2 className="mb-3 text-lg font-semibold">{t("scenarios")}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="flex flex-col gap-1 p-5">
            <p className="font-medium">{t("incomeDrop")}</p>
            <p className="text-sm text-muted-foreground">
              {!r.averages
                ? t("incomeDropUnknown")
                : r.scenarios.incomeDrop.months === null
                  ? t("incomeDropOk", {
                      amount: money(r.scenarios.incomeDrop.monthlyNet),
                    })
                  : t("incomeDropShort", {
                      amount: money(-r.scenarios.incomeDrop.monthlyNet),
                      months: months(r.scenarios.incomeDrop.months),
                    })}
            </p>
          </Card>
          <Card className="flex flex-col gap-1 p-5">
            <p className="font-medium">
              {t("shock", { amount: money(r.scenarios.shock.amount) })}
            </p>
            <p className="text-sm text-muted-foreground">
              {r.scenarios.shock.months === null
                ? t("noData")
                : t("shockResult", {
                    months: months(r.scenarios.shock.months),
                  })}
            </p>
          </Card>
        </div>
      </section>

      {(r.essentialRules.length > 0 || r.envelopeMonthly > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>{t("essentials")}</CardTitle>
            <CardDescription>{money(r.essentialMonthly)}</CardDescription>
          </CardHeader>
          <ul className="divide-y border-t text-sm">
            {r.essentialRules.map((rule) => {
              const category = categories.find((c) => c.id === rule.categoryId);
              return (
                <li
                  key={rule.id}
                  className="flex justify-between gap-3 px-6 py-2.5"
                >
                  <span className="truncate">
                    {rule.note ||
                      (category
                        ? categoryPath(category, categories, tCategories)
                        : "—")}
                  </span>
                  <span className="tabular-nums">{money(rule.monthly)}</span>
                </li>
              );
            })}
            {r.envelopeMonthly > 0 && (
              <li className="flex justify-between gap-3 px-6 py-2.5">
                <span>{t("envelopes")}</span>
                <span className="tabular-nums">{money(r.envelopeMonthly)}</span>
              </li>
            )}
          </ul>
        </Card>
      )}
    </div>
  );
}
