"use client";

import type { Locale } from "@projectb/core";
import { Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useActionState } from "react";
import { useFormErrors } from "@/components/auth/use-form-errors";
import { Alert } from "@/components/ui/alert";
import { ConfirmSubmit } from "@/components/ui/confirm-submit";
import { deleteAccount } from "@/lib/actions/finance";
import { initialFormState } from "@/lib/actions/state";

export function DeleteAccountButton({ accountId }: { accountId: string }) {
  const t = useTranslations("Common");
  const locale = useLocale() as Locale;
  const [state, action] = useActionState(
    deleteAccount.bind(null, locale, accountId),
    initialFormState,
  );
  const { formError } = useFormErrors(state);
  return (
    <form action={action} className="flex flex-col gap-2">
      <ConfirmSubmit variant="destructive" message={t("confirmDelete")}>
        <Trash2 />
        {t("delete")}
      </ConfirmSubmit>
      {formError && <Alert>{formError}</Alert>}
    </form>
  );
}
