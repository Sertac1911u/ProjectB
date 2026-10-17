import type { Statement, StatementLine } from "@projectb/core";
import { AlarmClock, CreditCard } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Amount } from "@/components/finance/amount";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Link } from "@/i18n/navigation";
import { categoryName } from "@/lib/categories";
import { type CardAccount, getCardOverview } from "@/lib/data/cards";
import { getCategories } from "@/lib/data/finance";
import { daysBetween, formatDay, today as todayIn } from "@/lib/dates";
import { cn } from "@/lib/utils";

export async function CardOverview({
  card,
  statementDate,
}: {
  card: CardAccount;
  statementDate?: string;
}) {
  const today = todayIn();
  const [overview, categories, locale, t] = await Promise.all([
    getCardOverview(card, today, statementDate),
    getCategories(),
    getLocale(),
    getTranslations("Card"),
  ]);
  const { statement, current, upcoming, history, latest, debt, transactions } =
    overview;
  const money = (value: number, className?: string) => (
    <Amount
      value={value}
      currency={card.currency}
      locale={locale}
      className={className}
    />
  );

  const byId = new Map(transactions.map((tx) => [tx.id, tx]));
  const tCategories = await getTranslations("Categories");
  const describe = (line: StatementLine) => {
    const tx = byId.get(line.transactionId);
    const category = categories.find((c) => c.id === tx?.categoryId);
    if (line.amount < 0) return tx?.note || t("payment");
    return tx?.note || (category ? categoryName(category, tCategories) : "—");
  };

  const used = Math.max(0, debt);
  const usage = card.creditLimit
    ? Math.min(100, (used / card.creditLimit) * 100)
    : null;
  const daysLeft = daysBetween(today, statement.dueDate);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">{t("totalDebt")}</p>
          {money(used, "text-2xl font-semibold")}
        </Card>
        {card.creditLimit !== null && (
          <Card className="flex flex-col gap-2 p-5">
            <p className="text-sm text-muted-foreground">{t("available")}</p>
            {money(card.creditLimit - used, "text-2xl font-semibold")}
            <Progress
              value={usage ?? 0}
              label={t("limit")}
              tone={(usage ?? 0) > 90 ? "danger" : "default"}
            />
            <p className="text-xs text-muted-foreground">
              {t("limit")}: {money(card.creditLimit)}
            </p>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader className="gap-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle>
                {t("statementOf", {
                  date: formatDay(statement.statementDate, locale),
                })}
              </CardTitle>
              <CardDescription>
                {t("period", {
                  from: formatDay(statement.periodStart, locale, "medium"),
                  to: formatDay(statement.statementDate, locale, "medium"),
                })}
              </CardDescription>
            </div>
            {statement.remaining > 0 && (
              <Link
                href={{
                  pathname: "/transactions/new",
                  query: {
                    kind: "transfer",
                    to: card.id,
                    amount: statement.remaining,
                  },
                }}
                className={buttonVariants()}
              >
                <CreditCard />
                {t("pay")}
              </Link>
            )}
          </div>
          <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
            <Stat label={t("statementAmount")}>
              {money(Math.max(0, statement.amount), "font-semibold")}
            </Stat>
            <Stat label={t("minimumPayment")}>
              {money(statement.minimumPayment)}
            </Stat>
            <Stat label={t("paid")}>{money(statement.paidSince)}</Stat>
            <Stat label={t("remaining")}>
              {money(statement.remaining, "font-semibold")}
            </Stat>
          </dl>
          <p
            className={cn(
              "flex items-center gap-2 text-sm",
              statement.remaining > 0 && daysLeft < 0
                ? "text-destructive"
                : "text-muted-foreground",
            )}
          >
            <AlarmClock className="size-4" />
            {t("dueDate")}: {formatDay(statement.dueDate, locale)}
            {statement.remaining > 0 &&
              (daysLeft < 0
                ? ` · ${t("overdue")}`
                : ` · ${t("daysLeft", { days: daysLeft })}`)}
            {statement.remaining === 0 &&
              ` · ${statement.amount > 0 ? t("paidInFull") : t("noDebt")}`}
          </p>
        </CardHeader>
        <Lines
          lines={statement.lines}
          describe={describe}
          currency={card.currency}
          locale={locale}
        />
      </Card>

      {statement.statementDate === latest && (
        <Card>
          <CardHeader>
            <CardTitle>{t("currentPeriod")}</CardTitle>
            <CardDescription>
              {t("currentPeriodHint", {
                date: formatDay(current.statementDate, locale),
              })}
            </CardDescription>
          </CardHeader>
          <Lines
            lines={current.lines}
            describe={describe}
            currency={card.currency}
            locale={locale}
          />
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("upcoming")}</CardTitle>
          <CardDescription>{t("upcomingHint")}</CardDescription>
        </CardHeader>
        {upcoming.every((u) => u.amount === 0) ? (
          <p className="px-5 pb-5 text-sm text-muted-foreground">
            {t("noUpcoming")}
          </p>
        ) : (
          <ul className="divide-y border-t">
            {upcoming
              .filter((u) => u.amount > 0)
              .map((u) => (
                <li
                  key={u.statementDate}
                  className="flex justify-between px-5 py-2.5 text-sm"
                >
                  <span>{formatDay(u.statementDate, locale)}</span>
                  {money(u.amount)}
                </li>
              ))}
          </ul>
        )}
      </Card>

      {history.length > 1 && (
        <Card className="p-5">
          <p className="mb-3 text-sm font-medium">{t("previousStatements")}</p>
          <div className="flex flex-wrap gap-2">
            {history.map((date) => (
              <Link
                key={date}
                href={{
                  pathname: `/accounts/${card.id}`,
                  query: { statement: date },
                }}
                aria-current={
                  date === statement.statementDate ? "page" : undefined
                }
                className={buttonVariants({
                  variant:
                    date === statement.statementDate ? "default" : "outline",
                  size: "sm",
                })}
              >
                {formatDay(date, locale, "medium")}
              </Link>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function Stat({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

async function Lines({
  lines,
  describe,
  currency,
  locale,
}: {
  lines: Statement["lines"];
  describe: (line: StatementLine) => string;
  currency: string;
  locale: string;
}) {
  const t = await getTranslations("Card");
  if (lines.length === 0) {
    return (
      <p className="px-5 pb-5 text-sm text-muted-foreground">{t("noLines")}</p>
    );
  }
  return (
    <ul className="divide-y border-t">
      {lines.map((line) => (
        <li key={`${line.transactionId}-${line.installment?.number ?? 0}`}>
          <Link
            href={`/transactions/${line.transactionId}`}
            className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm hover:bg-muted/60"
          >
            <span className="min-w-0">
              <span className="block truncate">{describe(line)}</span>
              <span className="text-xs text-muted-foreground">
                {formatDay(line.occurredOn, locale, "medium")}
                {line.installment && ` · ${t("installment", line.installment)}`}
              </span>
            </span>
            {/* Charges add to the debt; payments and refunds show as credits. */}
            <Amount
              value={Math.abs(line.amount)}
              currency={currency}
              locale={locale}
              kind={line.amount < 0 ? "income" : undefined}
            />
          </Link>
        </li>
      ))}
    </ul>
  );
}
