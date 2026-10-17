"use client";

import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Suspense, useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { Link } from "@/i18n/navigation";
import { signIn } from "@/lib/actions/auth";
import { initialFormState } from "@/lib/actions/state";
import { useFormErrors } from "./use-form-errors";
import { useFieldId } from "@/components/ui/use-field-id";

export function LoginForm() {
  const fid = useFieldId();
  const t = useTranslations("Auth");
  const locale = useLocale();
  const [state, action] = useActionState(signIn, initialFormState);
  const { formError, fieldError } = useFormErrors(state);

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="locale" value={locale} />
      {formError && <Alert>{formError}</Alert>}
      {/* Query params are read in their own boundary so the form itself stays
          in the static shell and works before JavaScript loads. */}
      <Suspense fallback={null}>
        <QueryParams hideLinkError={Boolean(formError)} />
      </Suspense>
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
      <Field
        id={fid("password")}
        label={t("password")}
        error={fieldError("password")}
      >
        <Input
          id={fid("password")}
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={Boolean(fieldError("password"))}
        />
      </Field>
      <Link
        href="/forgot-password"
        className="-mt-1 self-end text-sm text-primary hover:underline"
      >
        {t("login.forgot")}
      </Link>
      <SubmitButton>{t("login.submit")}</SubmitButton>
    </form>
  );
}

function QueryParams({ hideLinkError }: { hideLinkError: boolean }) {
  const t = useTranslations("Auth");
  const params = useSearchParams();
  const next = params.get("next");
  return (
    <>
      {next && <input type="hidden" name="next" value={next} />}
      {params.get("error") === "link" && !hideLinkError && (
        <Alert>{t("linkError")}</Alert>
      )}
    </>
  );
}
