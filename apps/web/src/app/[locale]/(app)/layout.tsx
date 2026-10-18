import { Suspense } from "react";
import { AppNav } from "@/components/app-nav";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Logo } from "@/components/logo";
import { MobileMenu } from "@/components/shell/mobile-menu";
import { SidebarToggle } from "@/components/shell/sidebar-toggle";
import { UserMenu, UserMenuSkeleton } from "@/components/user-menu";
import { getProfile } from "@/lib/auth";
import { uiModeOf } from "@/lib/ui-mode";

export default function AppLayout({ children }: LayoutProps<"/[locale]">) {
  return (
    <div className="md:flex">
      {/* Small screens: a top bar, with the menu in a drawer. */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b bg-card/90 px-4 py-2 backdrop-blur md:hidden">
        <Logo />
        <MobileMenu>
          <Navigation />
          <div className="mt-auto flex flex-col gap-3 border-t pt-4">
            <Suspense fallback={<UserMenuSkeleton />}>
              <UserMenu />
            </Suspense>
            <LanguageSwitcher persist />
          </div>
        </MobileMenu>
      </header>
      <aside className="app-sidebar sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-5 border-r bg-card px-3 py-4 transition-[width] duration-200 md:flex sidebar-collapsed:w-[4.5rem]">
        <div className="px-1">
          <Logo />
        </div>
        <Navigation />
        <div className="mt-auto flex flex-col gap-3 border-t pt-3">
          <SidebarToggle />
          <Suspense fallback={<UserMenuSkeleton />}>
            <UserMenu />
          </Suspense>
          <div className="sidebar-collapsed:hidden">
            <LanguageSwitcher persist />
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 sm:py-8">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  );
}

function Navigation() {
  // Until the profile loads, the menu shows the simple set of links.
  return (
    <Suspense fallback={<AppNav mode="simple" />}>
      <ModeNav />
    </Suspense>
  );
}

async function ModeNav() {
  const profile = await getProfile();
  return <AppNav mode={uiModeOf(profile)} />;
}
