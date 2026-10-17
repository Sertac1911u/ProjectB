import {
  CURRENCIES,
  type CurrencyCode,
  isCurrencyCode,
  isLocale,
} from "@projectb/core";
import { LogOut, Tags } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { RatesNote } from "@/components/finance/rates-note";
import { PageHeader } from "@/components/page-header";
import { ProfileForm } from "@/components/settings/profile-form";
import { uiModeOf } from "@/lib/ui-mode";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { signOut } from "@/lib/actions/auth";
import { getProfile } from "@/lib/auth";
import { getRates } from "@/lib/data/rates";

export default async function SettingsPage() {
  const t = await getTranslations("Settings");
  const tNav = await getTranslations("Nav");

  return (
    <>
      <PageHeader title={tNav("settings")} />
      <div className="flex max-w-2xl flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>{t("profileTitle")}</CardTitle>
            <CardDescription>{t("profileDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense
              fallback={
                <div className="h-56 animate-pulse rounded-md bg-muted" />
              }
            >
              <ProfileSection />
            </Suspense>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("categoriesTitle")}</CardTitle>
            <CardDescription>{t("categoriesDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/settings/categories"
              className={buttonVariants({ variant: "outline" })}
            >
              <Tags />
              {(await getTranslations("Categories"))("manage")}
            </Link>
          </CardContent>
        </Card>
        <Suspense
          fallback={<div className="h-40 animate-pulse rounded-xl bg-muted" />}
        >
          <RatesCard />
        </Suspense>
        <Card>
          <CardHeader>
            <CardTitle>{t("securityTitle")}</CardTitle>
            <Suspense
              fallback={<div className="h-5 animate-pulse rounded bg-muted" />}
            >
              <SecurityDescription />
            </Suspense>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Link
              href="/reset-password"
              className={buttonVariants({ variant: "outline" })}
            >
              {t("changePassword")}
            </Link>
            <SignOutButton />
          </CardContent>
        </Card>
      </div>
    </>
  );
}

async function ProfileSection() {
  const profile = await getProfile();
  return (
    <ProfileForm
      profile={{
        displayName: profile.displayName,
        locale: isLocale(profile.locale) ? profile.locale : "tr",
        baseCurrency: isCurrencyCode(profile.baseCurrency)
          ? profile.baseCurrency
          : "TRY",
        uiMode: uiModeOf(profile),
      }}
    />
  );
}

async function SecurityDescription() {
  const [profile, t] = await Promise.all([
    getProfile(),
    getTranslations("Settings"),
  ]);
  return (
    <CardDescription>
      {t("securityDescription", { email: profile.email })}
    </CardDescription>
  );
}

async function SignOutButton() {
  const [locale, t] = await Promise.all([getLocale(), getTranslations("Auth")]);
  return (
    <form action={signOut}>
      <input type="hidden" name="locale" value={locale} />
      <button type="submit" className={buttonVariants({ variant: "ghost" })}>
        <LogOut />
        {t("signOut")}
      </button>
    </form>
  );
}

async function RatesCard() {
  const [info, locale, t] = await Promise.all([
    getRates(),
    getLocale(),
    getTranslations("Rates"),
  ]);
  const currencies = (Object.keys(CURRENCIES) as CurrencyCode[]).filter(
    (c) => c !== "TRY",
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-3 gap-3">
          {currencies.map((currency) => (
            <div key={currency} className="rounded-lg bg-muted/60 p-3">
              <dt className="text-xs text-muted-foreground">
                {t("unit", { currency })}
              </dt>
              <dd className="font-medium tabular-nums">
                {info.rates[currency]
                  ? new Intl.NumberFormat(locale, {
                      style: "currency",
                      currency: "TRY",
                      currencyDisplay: "narrowSymbol",
                      maximumFractionDigits: 4,
                    }).format(info.rates[currency])
                  : "—"}
              </dd>
            </div>
          ))}
        </dl>
        <RatesNote info={info} />
      </CardContent>
    </Card>
  );
}
