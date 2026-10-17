import { DEFAULT_CURRENCY, formatMoney } from "@projectb/core";
import { ChartPie } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function DashboardPage() {
  const t = await getTranslations("Dashboard");
  const tNav = await getTranslations("Nav");
  const locale = await getLocale();
  const zero = formatMoney(0, DEFAULT_CURRENCY, locale);

  return (
    <>
      <PageHeader title={tNav("dashboard")} />
      <div className="grid gap-4 sm:grid-cols-3">
        {(["netWorth", "income", "expense"] as const).map((key) => (
          <Card key={key}>
            <CardHeader>
              <CardDescription>{t(key)}</CardDescription>
              <CardTitle className="text-2xl tabular-nums">{zero}</CardTitle>
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
