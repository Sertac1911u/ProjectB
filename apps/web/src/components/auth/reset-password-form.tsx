"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { Link } from "@/i18n/navigation";
import { updatePassword } from "@/lib/actions/auth";
import { initialFormState } from "@/lib/actions/state";
import { useFormErrors } from "./use-form-errors";
import { useFieldId } from "@/components/ui/use-field-id";

export function ResetPasswordForm() {
  const fid = useFieldId();
  const t = useTranslations("Auth");
  const [state, action] = useActionState(updatePassword, initialFormState);
  const { formError, fieldError } = useFormErrors(state);

  if (state.status === "success") {
    return (
      <div className="flex flex-col gap-4">
        <Alert variant="success">{t("reset.done")}</Alert>
        <Link href="/dashboard" className={buttonVariants()}>
          {t("reset.continue")}
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {formError && <Alert>{formError}</Alert>}
      <Field
        id={fid("password")}
        label={t("newPassword")}
        hint={t("passwordHint")}
        error={fieldError("password")}
      >
        <Input
          id={fid("password")}
          name="password"
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={Boolean(fieldError("password"))}
        />
      </Field>
      <Field
        id={fid("confirmPassword")}
        label={t("confirmPassword")}
        error={fieldError("confirmPassword")}
      >
        <Input
          id={fid("confirmPassword")}
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={Boolean(fieldError("confirmPassword"))}
        />
      </Field>
      <SubmitButton>{t("reset.submit")}</SubmitButton>
    </form>
  );
}
