"use client";

import type { UiMode } from "@projectb/core";
import {
  ArrowLeftRight,
  CalendarClock,
  ChartPie,
  HandCoins,
  LayoutDashboard,
  type LucideIcon,
  PiggyBank,
  Repeat,
  Settings,
  Target,
  Wallet,
} from "lucide-react";
import { type Messages, useTranslations } from "next-intl";
import { Suspense } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const items: {
  href: string;
  key: keyof Messages["Nav"];
  icon: LucideIcon;
  /** Shown in the simple interface too. */
  simple: boolean;
}[] = [
  { href: "/dashboard", key: "dashboard", icon: LayoutDashboard, simple: true },
  { href: "/cashflow", key: "cashflow", icon: CalendarClock, simple: true },
  { href: "/accounts", key: "accounts", icon: Wallet, simple: true },
  {
    href: "/transactions",
    key: "transactions",
    icon: ArrowLeftRight,
    simple: true,
  },
  { href: "/recurring", key: "recurring", icon: Repeat, simple: false },
  { href: "/budgets", key: "budgets", icon: PiggyBank, simple: false },
  { href: "/goals", key: "goals", icon: Target, simple: true },
  { href: "/debts", key: "debts", icon: HandCoins, simple: false },
  { href: "/reports", key: "reports", icon: ChartPie, simple: false },
  { href: "/settings", key: "settings", icon: Settings, simple: true },
];

export function AppNav({ mode }: { mode: UiMode }) {
  // The current path is only known per request; until then the links render
  // without the active highlight, so the static shell already has the menu.
  return (
    <Suspense fallback={<NavLinks pathname={null} mode={mode} />}>
      <ActiveNav mode={mode} />
    </Suspense>
  );
}

function ActiveNav({ mode }: { mode: UiMode }) {
  return <NavLinks pathname={usePathname()} mode={mode} />;
}

function NavLinks({
  pathname,
  mode,
}: {
  pathname: string | null;
  mode: UiMode;
}) {
  const t = useTranslations("Nav");

  return (
    <nav className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
      {items
        .filter((item) => mode === "detailed" || item.simple)
        .map(({ href, key, icon: Icon }) => {
          const active =
            pathname !== null &&
            (pathname === href || pathname.startsWith(`${href}/`));
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex shrink-0 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
              {t(key)}
            </Link>
          );
        })}
    </nav>
  );
}
