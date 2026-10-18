"use client";

import type { Locale } from "@projectb/core";
import { useLocale, useTranslations } from "next-intl";
import { useActionState } from "react";
import { useFormErrors } from "@/components/auth/use-form-errors";
import { Alert } from "@/components/ui/alert";
import { ConfirmSubmit } from "@/components/ui/confirm-submit";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useFieldId } from "@/components/ui/use-field-id";
import { deleteUserAccount, resetData } from "@/lib/actions/profile";
import { initialFormState } from "@/lib/actions/state";

/** Resetting all data or deleting the account, each behind the password. */
export function DangerZone() {
  return (
    <div className="flex flex-col gap-6">
      <DangerForm kind="reset" />
      <div className="border-t" />
      <DangerForm kind="delete" />
    </div>
  );
}

function DangerForm({ kind }: { kind: "reset" | "delete" }) {
  const fid = useFieldId();
  const t = useTranslations("Settings");
  const locale = useLocale() as Locale;
  const [state, action] = useActionState(
    (kind === "reset" ? resetData : deleteUserAccount).bind(null, locale),
    initialFormState,
  );
  const { formError, fieldError } = useFormErrors(state);
  const id = fid(`${kind}-password`);
  return (
    <form
      key={state.nonce ?? "initial"}
      action={action}
      className="flex flex-col gap-3"
      noValidate
    >
      <div>
        <p className="font-medium">
          {kind === "reset" ? t("resetTitle") : t("deleteTitle")}
        </p>
        <p className="text-sm text-muted-foreground">
          {kind === "reset" ? t("resetText") : t("deleteText")}
        </p>
      </div>
      {formError && <Alert>{formError}</Alert>}
      <Field
        id={id}
        label={t("confirmPassword")}
        error={fieldError("password")}
      >
        <Input
          id={id}
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="max-w-sm"
          aria-invalid={Boolean(fieldError("password"))}
        />
      </Field>
      <div>
        <ConfirmSubmit
          variant="destructive"
          className="border border-destructive/30"
          message={
            kind === "reset" ? t("confirmReset") : t("confirmDeleteAccount")
          }
          title={
            kind === "reset"
              ? t("confirmResetTitle")
              : t("confirmDeleteAccountTitle")
          }
          confirmLabel={kind === "reset" ? t("resetButton") : t("deleteButton")}
        >
          {kind === "reset" ? t("resetButton") : t("deleteButton")}
        </ConfirmSubmit>
      </div>
    </form>
  );
}
