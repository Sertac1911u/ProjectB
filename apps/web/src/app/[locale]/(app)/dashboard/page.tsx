import { DEFAULT_CURRENCY, formatMoney, isCurrencyCode } from "@projectb/core";
import { ChartPie } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getProfile } from "@/lib/auth";

const SUMMARY = ["netWorth", "income", "expense"] as const;

export default async function DashboardPage() {
  const t = await getTranslations("Dashboard");

  return (
    <>
      <Suspense
        fallback={
          <div className="mb-6 h-8 w-48 animate-pulse rounded bg-muted" />
        }
      >
        <Greeting />
      </Suspense>
      <div className="grid gap-4 sm:grid-cols-3">
        {SUMMARY.map((key) => (
          <Card key={key}>
            <CardHeader>
              <CardDescription>{t(key)}</CardDescription>
              <Suspense
                fallback={
                  <div className="h-8 w-24 animate-pulse rounded bg-muted" />
                }
              >
                <ZeroAmount />
              </Suspense>
            </CardHeader>
          </Card>
        ))}
      </div>
      <Card className="mt-4 flex flex-col items-center gap-3 px-6 py-16 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <ChartPie className="size-5" />
        </span>
        <p className="font-medium">{t("emptyTitle")}</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          {t("emptyDescription")}
        </p>
      </Card>
    </>
  );
}

async function Greeting() {
  const [profile, t] = await Promise.all([
    getProfile(),
    getTranslations("Dashboard"),
  ]);
  return (
    <h1 className="mb-6 text-2xl font-semibold tracking-tight">
      {profile.displayName
        ? t("greeting", { name: profile.displayName })
        : t("greetingNoName")}
    </h1>
  );
}

/** Placeholder until accounts exist; shown in the user's main currency. */
async function ZeroAmount() {
  const [profile, locale] = await Promise.all([getProfile(), getLocale()]);
  const currency = isCurrencyCode(profile.baseCurrency)
    ? profile.baseCurrency
    : DEFAULT_CURRENCY;
  return (
    <CardTitle className="text-2xl tabular-nums">
      {formatMoney(0, currency, locale)}
    </CardTitle>
  );
}
