"use client";

import type { Locale } from "@projectb/core";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { saveLocale } from "@/lib/actions/profile";
import { cn } from "@/lib/utils";

/** `persist` also stores the choice in the signed-in user's profile. */
export function LanguageSwitcher({ persist = false }: { persist?: boolean }) {
  const t = useTranslations("Common");
  const current = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function switchTo(locale: Locale) {
    startTransition(async () => {
      if (persist) await saveLocale(locale);
      router.replace(pathname, { locale });
    });
  }

  return (
    <div
      role="group"
      aria-label={t("language")}
      aria-busy={pending}
      className="inline-flex rounded-md border bg-card p-0.5"
    >
      {routing.locales.map((locale) => (
        <button
          key={locale}
          type="button"
          aria-pressed={locale === current}
          disabled={pending}
          onClick={() => switchTo(locale)}
          className={cn(
            "rounded px-2.5 py-1 text-xs font-medium uppercase transition-colors",
            locale === current
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {locale}
        </button>
      ))}
    </div>
  );
}
