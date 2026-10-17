"use client";

import {
  ArrowLeftRight,
  ChartPie,
  LayoutDashboard,
  type LucideIcon,
  PiggyBank,
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
}[] = [
  { href: "/dashboard", key: "dashboard", icon: LayoutDashboard },
  { href: "/accounts", key: "accounts", icon: Wallet },
  { href: "/transactions", key: "transactions", icon: ArrowLeftRight },
  { href: "/budgets", key: "budgets", icon: PiggyBank },
  { href: "/goals", key: "goals", icon: Target },
  { href: "/reports", key: "reports", icon: ChartPie },
  { href: "/settings", key: "settings", icon: Settings },
];

export function AppNav() {
  // The current path is only known per request; until then the links render
  // without the active highlight, so the static shell already has the menu.
  return (
    <Suspense fallback={<NavLinks pathname={null} />}>
      <ActiveNav />
    </Suspense>
  );
}

function ActiveNav() {
  return <NavLinks pathname={usePathname()} />;
}

function NavLinks({ pathname }: { pathname: string | null }) {
  const t = useTranslations("Nav");

  return (
    <nav className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
      {items.map(({ href, key, icon: Icon }) => {
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
