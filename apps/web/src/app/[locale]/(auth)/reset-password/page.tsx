import { getTranslations } from "next-intl/server";
import { AuthCard } from "@/components/auth/auth-card";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export default async function ResetPasswordPage() {
  const t = await getTranslations("Auth");

  return (
    <AuthCard title={t("reset.title")} description={t("reset.description")}>
      <ResetPasswordForm />
    </AuthCard>
  );
}
