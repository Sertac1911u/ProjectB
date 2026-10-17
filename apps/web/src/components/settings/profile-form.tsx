"use client";

import {
  CURRENCIES,
  type CurrencyCode,
  LOCALES,
  type Locale,
} from "@projectb/core";
import { useLocale, useTranslations } from "next-intl";
import { useActionState } from "react";
import { useFormErrors } from "@/components/auth/use-form-errors";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { updateProfile } from "@/lib/actions/profile";
import { initialFormState } from "@/lib/actions/state";
import { useFieldId } from "@/components/ui/use-field-id";

type Props = {
  profile: {
    displayName: string | null;
    locale: Locale;
    baseCurrency: CurrencyCode;
  };
};

export function ProfileForm({ profile }: Props) {
  const fid = useFieldId();
  const t = useTranslations("Settings");
  const locale = useLocale();
  const [state, action] = useActionState(
    updateProfile.bind(null, locale),
    initialFormState,
  );
  const { formError, fieldError } = useFormErrors(state);

  return (
    // Remount after a save: React resets the form, and a select would otherwise
    // fall back to the value it was first rendered with.
    <form
      key={JSON.stringify(profile)}
      action={action}
      className="flex flex-col gap-4"
      noValidate
    >
      {formError && <Alert>{formError}</Alert>}
      <Field
        id={fid("displayName")}
        label={t("displayName")}
        error={fieldError("displayName")}
      >
        <Input
          id={fid("displayName")}
          name="displayName"
          autoComplete="nickname"
          placeholder={t("displayNamePlaceholder")}
          defaultValue={profile.displayName ?? ""}
          aria-invalid={Boolean(fieldError("displayName"))}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id={fid("locale")}
          label={t("language")}
          error={fieldError("locale")}
        >
          <Select
            id={fid("locale")}
            name="locale"
            defaultValue={profile.locale}
          >
            {LOCALES.map((value) => (
              <option key={value} value={value}>
                {t(`languages.${value}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          id={fid("baseCurrency")}
          label={t("baseCurrency")}
          hint={t("baseCurrencyHint")}
          error={fieldError("baseCurrency")}
        >
          <Select
            id={fid("baseCurrency")}
            name="baseCurrency"
            defaultValue={profile.baseCurrency}
          >
            {(Object.keys(CURRENCIES) as CurrencyCode[]).map((code) => (
              <option key={code} value={code}>
                {t(`currencies.${code}`)}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="flex items-center gap-3">
        <SubmitButton>{t("save")}</SubmitButton>
        {state.status === "success" && (
          <p role="status" className="text-sm text-accent-foreground">
            {t("saved")}
          </p>
        )}
      </div>
    </form>
  );
}
