import { getTranslations } from "next-intl/server";
import { AuthCard } from "@/components/auth/auth-card";
import { SignupForm } from "@/components/auth/signup-form";
import { Link } from "@/i18n/navigation";

export default async function SignupPage() {
  const t = await getTranslations("Auth");

  return (
    <AuthCard
      title={t("signup.title")}
      description={t("signup.description")}
      footer={
        <>
          {t("signup.haveAccount")}{" "}
          <Link
            href="/login"
            className="font-medium text-primary hover:underline"
          >
            {t("signup.loginLink")}
          </Link>
        </>
      }
    >
      <SignupForm />
    </AuthCard>
  );
}
