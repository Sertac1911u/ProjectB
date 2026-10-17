"use client";

import type { Locale } from "@projectb/core";
import { useLocale, useTranslations } from "next-intl";
import { Suspense, useTransition } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { saveLocale } from "@/lib/actions/profile";
import { cn } from "@/lib/utils";

type Props = { persist?: boolean };

/** `persist` also stores the choice in the signed-in user's profile. */
export function LanguageSwitcher(props: Props) {
  // Reading the current path needs the request, so the static shell shows
  // the same buttons until it is available.
  return (
    <Suspense fallback={<Buttons onSelect={null} />}>
      <ActiveSwitcher {...props} />
    </Suspense>
  );
}

function ActiveSwitcher({ persist = false }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Buttons
      pending={pending}
      onSelect={(locale) =>
        startTransition(async () => {
          if (persist) await saveLocale(locale);
          router.replace(pathname, { locale });
        })
      }
    />
  );
}

function Buttons({
  onSelect,
  pending = false,
}: {
  onSelect: ((locale: Locale) => void) | null;
  pending?: boolean;
}) {
  const t = useTranslations("Common");
  const current = useLocale();

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
          disabled={pending || !onSelect}
          onClick={() => onSelect?.(locale)}
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
