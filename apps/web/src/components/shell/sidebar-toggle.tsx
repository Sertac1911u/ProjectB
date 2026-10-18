"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";
import {
  currentPreference,
  subscribePreferences,
  writePreference,
} from "@/lib/preferences";

/** Narrows the sidebar to its icons, remembered on this device. */
export function SidebarToggle() {
  const t = useTranslations("Shell");
  const collapsed = useSyncExternalStore(
    subscribePreferences,
    () => currentPreference("sidebar") === "collapsed",
    () => false,
  );

  const Icon = collapsed ? PanelLeftOpen : PanelLeftClose;
  const label = collapsed ? t("expand") : t("collapse");
  return (
    <button
      type="button"
      aria-expanded={!collapsed}
      title={label}
      onClick={() => {
        writePreference("sidebar", collapsed ? null : "collapsed");
      }}
      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sidebar-collapsed:justify-center sidebar-collapsed:px-0"
    >
      <Icon className="size-4.5 shrink-0" />
      <span className="sidebar-collapsed:sr-only">{label}</span>
    </button>
  );
}
