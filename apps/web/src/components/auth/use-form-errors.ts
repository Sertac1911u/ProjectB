"use client";

import { useTranslations } from "next-intl";
import type { FormState } from "@/lib/actions/state";

/** Translates the error codes a Server Action returned. */
export function useFormErrors(state: FormState) {
  const t = useTranslations("Errors");
  return {
    formError: state.error ? t(state.error) : undefined,
    fieldError: (name: string) => {
      const code = state.fieldErrors?.[name];
      return code ? t(code) : undefined;
    },
  };
}
