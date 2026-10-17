"use client";

import { MailCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { signUp } from "@/lib/actions/auth";
import { initialFormState } from "@/lib/actions/state";
import { useFormErrors } from "./use-form-errors";

export function SignupForm() {
  const t = useTranslations("Auth");
  const locale = useLocale();
  const [state, action] = useActionState(signUp, initialFormState);
  const { formError, fieldError } = useFormErrors(state);

  if (state.status === "success") {
    return (
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <MailCheck className="size-5" />
        </span>
        <p className="font-medium">{t("signup.checkEmailTitle")}</p>
        <p className="text-sm text-muted-foreground">
          {t("signup.checkEmail", { email: state.values?.email ?? "" })}
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="locale" value={locale} />
      {formError && <Alert>{formError}</Alert>}
      <Field id="email" label={t("email")} error={fieldError("email")}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state.values?.email}
          aria-invalid={Boolean(fieldError("email"))}
        />
      </Field>
      <Field
        id="password"
        label={t("password")}
        hint={t("passwordHint")}
        error={fieldError("password")}
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={Boolean(fieldError("password"))}
        />
      </Field>
      <SubmitButton>{t("signup.submit")}</SubmitButton>
    </form>
  );
}
