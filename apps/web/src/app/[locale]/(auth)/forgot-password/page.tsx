import { getTranslations } from "next-intl/server";
import { AuthCard } from "@/components/auth/auth-card";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { Link } from "@/i18n/navigation";

export default async function ForgotPasswordPage() {
  const t = await getTranslations("Auth");

  return (
    <AuthCard
      title={t("forgot.title")}
      description={t("forgot.description")}
      footer={
        <Link
          href="/login"
          className="font-medium text-primary hover:underline"
        >
          {t("forgot.back")}
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
