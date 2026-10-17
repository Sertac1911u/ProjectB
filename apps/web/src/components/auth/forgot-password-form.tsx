"use client";

import { useLocale, useTranslations } from "next-intl";
import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { requestPasswordReset } from "@/lib/actions/auth";
import { initialFormState } from "@/lib/actions/state";
import { useFormErrors } from "./use-form-errors";
import { useFieldId } from "@/components/ui/use-field-id";

export function ForgotPasswordForm() {
  const fid = useFieldId();
  const t = useTranslations("Auth");
  const locale = useLocale();
  const [state, action] = useActionState(
    requestPasswordReset,
    initialFormState,
  );
  const { formError, fieldError } = useFormErrors(state);

  if (state.status === "success") {
    return <Alert variant="success">{t("forgot.sent")}</Alert>;
  }

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="locale" value={locale} />
      {formError && <Alert>{formError}</Alert>}
      <Field id={fid("email")} label={t("email")} error={fieldError("email")}>
        <Input
          id={fid("email")}
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state.values?.email}
          aria-invalid={Boolean(fieldError("email"))}
        />
      </Field>
      <SubmitButton>{t("forgot.submit")}</SubmitButton>
    </form>
  );
}
