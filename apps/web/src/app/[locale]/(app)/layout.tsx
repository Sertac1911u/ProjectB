import { Suspense } from "react";
import { AppNav } from "@/components/app-nav";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Logo } from "@/components/logo";
import { UserMenu, UserMenuSkeleton } from "@/components/user-menu";
import { getProfile } from "@/lib/auth";
import { uiModeOf } from "@/lib/ui-mode";

export default function AppLayout({ children }: LayoutProps<"/[locale]">) {
  return (
    <div className="md:flex">
      <aside className="flex flex-col gap-4 border-b bg-card p-4 md:sticky md:top-0 md:h-dvh md:w-60 md:shrink-0 md:border-r md:border-b-0">
        <div className="flex items-center justify-between">
          <Logo />
          <div className="md:hidden">
            <LanguageSwitcher persist />
          </div>
        </div>
        {/* Until the profile loads, the menu shows the simple set of links. */}
        <Suspense fallback={<AppNav mode="simple" />}>
          <ModeNav />
        </Suspense>
        <div className="mt-auto hidden flex-col gap-3 border-t pt-4 md:flex">
          <Suspense fallback={<UserMenuSkeleton />}>
            <UserMenu />
          </Suspense>
          <LanguageSwitcher persist />
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 sm:py-8">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  );
}

async function ModeNav() {
  const profile = await getProfile();
  return <AppNav mode={uiModeOf(profile)} />;
}
