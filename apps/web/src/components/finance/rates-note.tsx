import { getLocale, getTranslations } from "next-intl/server";
import type { RateInfo } from "@/lib/data/rates";
import { formatDay } from "@/lib/dates";

/** Where converted totals come from, and whether something is missing. */
export async function RatesNote({
  info,
  missing = false,
}: {
  info: RateInfo;
  missing?: boolean;
}) {
  const [t, locale] = await Promise.all([
    getTranslations("Rates"),
    getLocale(),
  ]);
  const message = !info.date
    ? t("none")
    : missing
      ? t("missing")
      : info.stale
        ? t("stale", { date: formatDay(info.date, locale) })
        : t("source", { date: formatDay(info.date, locale) });
  const warn = !info.date || missing || info.stale;
  return (
    <p
      className={`mt-2 text-xs ${warn ? "text-destructive" : "text-muted-foreground"}`}
    >
      {message}
    </p>
  );
}
