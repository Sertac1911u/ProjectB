import {
  type ForecastEntry,
  formatMoney,
  isCurrencyCode,
} from "@projectb/core";
import { AlertTriangle, ArrowDownLeft, CreditCard, Repeat } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Amount } from "@/components/finance/amount";
import { Link } from "@/i18n/navigation";
import { categoryPath } from "@/lib/categories";
import type { CashForecast, CashSource } from "@/lib/data/cashflow";
import { getAccounts, getCategories } from "@/lib/data/finance";
import { formatDay } from "@/lib/dates";
import { cn } from "@/lib/utils";

/** Names the events of a forecast: a rule's note or category, or the card. */
export async function eventDescriber() {
  const [accounts, categories, t, tTransactions, tCategories] =
    await Promise.all([
      getAccounts(),
      getCategories(),
      getTranslations("CashFlow"),
      getTranslations("Transactions"),
      getTranslations("Categories"),
    ]);
  const accountName = (id: string | null) =>
    accounts.find((a) => a.id === id)?.name ?? "";
  return (source: CashSource) => {
    if (source.type === "card") {
      return t("cardPayment", { card: source.cardName });
    }
    if (source.note) return source.note;
    if (source.kind === "transfer") {
      return tTransactions("transferLabel", {
        from: accountName(source.accountId),
        to: accountName(source.toAccountId),
      });
    }
    const category = categories.find((c) => c.id === source.categoryId);
    return category
      ? categoryPath(category, categories, tCategories)
      : tTransactions(`kinds.${source.kind as "income" | "expense"}`);
  };
}

/** Upcoming income and payments with the balance expected after each. */
export async function CashTimeline({
  forecast,
  limit,
}: {
  forecast: CashForecast;
  /** Show at most this many rows, from today on. */
  limit?: number;
}) {
  const [describe, locale, t] = await Promise.all([
    eventDescriber(),
    getLocale(),
    getTranslations("CashFlow"),
  ]);
  const entries = limit ? forecast.entries.slice(0, limit) : forecast.entries;
  if (entries.length === 0) {
    return (
      <p className="px-5 py-4 text-sm text-muted-foreground">
        {t("upcomingEmpty")}
      </p>
    );
  }
  return (
    <ul className="divide-y">
      {entries.map((entry, i) => (
        <TimelineRow
          key={`${entry.on}-${i}`}
          entry={entry}
          label={describe(entry.source)}
          currency={forecast.currency}
          locale={locale}
          isPayday={
            entry.source.type === "recurring" &&
            entry.source.payday &&
            entry.on === forecast.payday
          }
          labels={{
            payday: t("payday"),
            overdue: t("overdue"),
            after: (amount: string) => t("after", { amount }),
          }}
        />
      ))}
    </ul>
  );
}

function TimelineRow({
  entry,
  label,
  currency,
  locale,
  isPayday,
  labels,
}: {
  entry: ForecastEntry<CashSource>;
  label: string;
  currency: string;
  locale: string;
  isPayday: boolean;
  labels: {
    payday: string;
    overdue: string;
    after: (amount: string) => string;
  };
}) {
  const source = entry.source;
  const Icon =
    source.type === "card"
      ? CreditCard
      : entry.amount > 0
        ? ArrowDownLeft
        : Repeat;
  const href =
    source.type === "card"
      ? `/accounts/${source.cardId}`
      : `/recurring/${source.ruleId}`;
  const negative = entry.balance < 0;
  const after = formatMoney(
    entry.balance,
    isCurrencyCode(currency) ? currency : "TRY",
    locale,
  );
  return (
    <li>
      <Link
        href={href}
        className={cn(
          "flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/60",
          isPayday && "bg-accent/40",
        )}
      >
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground",
            negative && "bg-destructive/10 text-destructive",
          )}
        >
          {negative ? (
            <AlertTriangle className="size-4" />
          ) : (
            <Icon className="size-4" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{label}</p>
          <p className="text-sm text-muted-foreground">
            {formatDay(entry.on, locale)}
            {isPayday && ` · ${labels.payday}`}
            {source.type === "card" && source.overdue && (
              <span className="text-destructive"> · {labels.overdue}</span>
            )}
          </p>
        </div>
        <div className="text-right">
          <Amount
            value={Math.abs(entry.amount)}
            currency={currency}
            locale={locale}
            kind={entry.amount > 0 ? "income" : "expense"}
            className="font-medium"
          />
          <p
            className={cn(
              "text-xs tabular-nums",
              negative
                ? "font-medium text-destructive"
                : "text-muted-foreground",
            )}
          >
            {labels.after(after)}
          </p>
        </div>
      </Link>
    </li>
  );
}
