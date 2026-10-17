import { isCurrencyCode, isLocale } from "@projectb/core";
import { LogOut, Tags } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { ProfileForm } from "@/components/settings/profile-form";
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
