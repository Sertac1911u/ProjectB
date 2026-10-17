import { LanguageSwitcher } from "@/components/language-switcher";
import { Logo } from "@/components/logo";

export default function AuthLayout({ children }: LayoutProps<"/[locale]">) {
  return (
    <div className="flex min-h-dvh flex-col px-4 sm:px-6">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between py-5">
        <Logo />
        <LanguageSwitcher />
      </header>
      <main className="flex flex-1 items-start justify-center pt-8 pb-16 sm:pt-16">
        {children}
      </main>
    </div>
  );
}
