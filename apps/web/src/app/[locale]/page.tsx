import {
  ArrowRight,
  CreditCard,
  Globe,
  type LucideIcon,
  PiggyBank,
  Wallet,
} from "lucide-react";
import type { Messages } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Logo } from "@/components/logo";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { getClaims } from "@/lib/auth";

const features: {
  key: keyof Messages["Landing"]["features"];
  icon: LucideIcon;
}[] = [
  { key: "accounts", icon: Wallet },
  { key: "cards", icon: CreditCard },
  { key: "budgets", icon: PiggyBank },
  { key: "currencies", icon: Globe },
];

export default async function LandingPage() {
  const t = await getTranslations("Landing");

  return (
    <div className="mx-auto flex min-h-dvh max-w-5xl flex-col px-4 sm:px-6">
      <header className="flex items-center justify-between py-5">
        <Logo />
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <Suspense fallback={<div className="h-8 w-20" />}>
            <HeaderAction />
          </Suspense>
        </div>
      </header>

      <main className="flex flex-1 flex-col justify-center gap-14 py-12">
        <section className="flex max-w-2xl flex-col gap-5">
          <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            {t("title")}
          </h1>
          <p className="text-lg text-muted-foreground">{t("subtitle")}</p>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/signup" className={buttonVariants({ size: "lg" })}>
              {t("getStarted")}
              <ArrowRight />
            </Link>
            <Link
              href="/login"
              className={buttonVariants({ variant: "outline", size: "lg" })}
            >
              {t("signIn")}
            </Link>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          {features.map(({ key, icon: Icon }) => (
            <Card key={key}>
              <CardHeader className="gap-2">
                <span className="mb-1 flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <Icon className="size-4" />
                </span>
                <CardTitle>{t(`features.${key}.title`)}</CardTitle>
                <CardDescription>
                  {t(`features.${key}.description`)}
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </section>
      </main>
    </div>
  );
}

async function HeaderAction() {
  const [claims, t] = await Promise.all([
    getClaims(),
    getTranslations("Landing"),
  ]);
  return claims ? (
    <Link href="/dashboard" className={buttonVariants({ size: "sm" })}>
      {t("openDashboard")}
    </Link>
  ) : (
    <Link
      href="/login"
      className={buttonVariants({ variant: "ghost", size: "sm" })}
    >
      {t("signIn")}
    </Link>
  );
}
