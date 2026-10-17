import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { locale as rootLocale } from "next/root-params";
import { routing } from "./routing";

export default getRequestConfig(async ({ locale: override, requestLocale }) => {
  const requested =
    override ??
    // Root params are unavailable in Server Actions and Route Handlers; the
    // proxy forwards the locale in a header for those.
    (await rootLocale().catch(() => requestLocale));
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
