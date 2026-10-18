"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";
import {
  currentPreference,
  subscribePreferences,
  writePreference,
} from "@/lib/preferences";
import { cn } from "@/lib/utils";

const THEMES = [
  { value: null, key: "system", icon: Monitor },
  { value: "light", key: "light", icon: Sun },
  { value: "dark", key: "dark", icon: Moon },
] as const;

/** Light, dark or the system's choice, remembered on this device. */
export function ThemeSwitcher() {
  const t = useTranslations("Shell");
  const theme = useSyncExternalStore(
    subscribePreferences,
    () => currentPreference("theme"),
    () => null,
  );

  return (
    <div
      role="group"
      aria-label={t("theme")}
      className="inline-flex rounded-md border bg-card p-0.5"
    >
      {THEMES.map(({ value, key, icon: Icon }) => (
        <button
          key={key}
          type="button"
          aria-pressed={theme === value}
          title={t(`themes.${key}`)}
          aria-label={t(`themes.${key}`)}
          onClick={() => writePreference("theme", value)}
          className={cn(
            "flex size-7 items-center justify-center rounded transition-colors",
            theme === value
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Icon className="size-3.5" />
        </button>
      ))}
    </div>
  );
}
