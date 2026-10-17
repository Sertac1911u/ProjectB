import { formatMoney } from "@projectb/core";
import { AlertTriangle, ArrowRight, Plus, Wallet } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import type { CashForecast } from "@/lib/data/cashflow";
import { formatDay } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { eventDescriber } from "./cash-timeline";

/** How much can be spent each day until payday, and what threatens it. */
export async function SafeToSpend({
  forecast,
  detailsLink = false,
}: {
  forecast: CashForecast;
  detailsLink?: boolean;
}) {
  const [describe, locale, t] = await Promise.all([
    eventDescriber(),
    getLocale(),
    getTranslations("CashFlow"),
  ]);
  const money = (v: number) => formatMoney(v, forecast.currency, locale);
  const toPayday = forecast.payday !== null;

  if (forecast.spendable.length === 0 && forecast.others.length === 0) {
    const tAccounts = await getTranslations("Accounts");
    return (
      <Card className="flex flex-col items-center gap-3 px-6 py-12 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <Wallet className="size-5" />
        </span>
        <p className="font-medium">{tAccounts("emptyTitle")}</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          {tAccounts("emptyDescription")}
        </p>
        <Link
          href="/accounts/new"
          className={buttonVariants({ className: "mt-2" })}
        >
          <Plus />
          {tAccounts("addFirst")}
        </Link>
      </Card>
    );
  }
  if (forecast.spendable.length === 0) {
    return (
      <Card className="flex flex-col items-start gap-3 p-6">
        <span className="flex size-10 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <Wallet className="size-5" />
        </span>
        <p className="text-sm text-muted-foreground">{t("noAccounts")}</p>
        <Link
          href="/accounts"
          className={buttonVariants({ variant: "outline" })}
        >
          {t("goToAccounts")}
        </Link>
      </Card>
    );
  }

  const short = forecast.safeToSpend < 0;
  const firstShortfall = forecast.shortfalls.find((e) => e.beforePayday);
  return (
    <Card className="flex flex-col gap-4 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-muted-foreground">
            {toPayday
              ? t("daysToPayday", { days: forecast.daysLeft })
              : t("daysToMonthEnd", { days: forecast.daysLeft })}
          </p>
          {short ? (
            <p className="flex items-center gap-2 text-2xl font-semibold text-destructive">
              <AlertTriangle className="size-6 shrink-0" />
              {toPayday
                ? t("shortfall", { amount: money(-forecast.safeToSpend) })
                : t("shortfallMonth", { amount: money(-forecast.safeToSpend) })}
            </p>
          ) : (
            <p className="text-3xl font-semibold tracking-tight">
              {t("perDay", { amount: money(forecast.dailyLimit) })}{" "}
              <span className="text-base font-normal text-muted-foreground">
                {t("perDayHint")}
              </span>
            </p>
          )}
        </div>
        {detailsLink && (
          <Link
            href="/cashflow"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            {t("details")}
            <ArrowRight />
          </Link>
        )}
      </div>

      <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
        {!short && (
          <li>
            {toPayday
              ? t("safeTotal", { amount: money(forecast.safeToSpend) })
              : t("safeTotalMonth", { amount: money(forecast.safeToSpend) })}
          </li>
        )}
        <li>{t("available", { amount: money(forecast.startBalance) })}</li>
        {forecast.lowest.balance < forecast.startBalance && (
          <li className={cn(short && "text-destructive")}>
            {t("lowest", {
              date: formatDay(forecast.lowest.on, locale),
              amount: money(forecast.lowest.balance),
            })}
          </li>
        )}
        {firstShortfall && (
          <li className="text-destructive">
            {t("shortfallAt", {
              date: formatDay(firstShortfall.on, locale),
              label: describe(firstShortfall.source),
              amount: money(firstShortfall.balance),
            })}
          </li>
        )}
        {forecast.missingRate && <li>{t("missingRates")}</li>}
      </ul>

      {!forecast.hasIncomeRule && (
        <div className="flex flex-wrap items-center gap-3 rounded-md bg-muted/60 p-3 text-sm">
          <p className="min-w-0 flex-1">{t("noPayday")}</p>
          <Link
            href={{ pathname: "/recurring/new", query: { kind: "income" } }}
            className={buttonVariants({ size: "sm" })}
          >
            <Plus />
            {t("addSalary")}
          </Link>
        </div>
      )}
    </Card>
  );
}
