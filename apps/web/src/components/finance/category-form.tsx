"use client";

import { CATEGORY_KINDS, type CategoryKind, type Locale } from "@projectb/core";
import { useLocale, useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { useFormErrors } from "@/components/auth/use-form-errors";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { saveCategory } from "@/lib/actions/finance";
import { initialFormState } from "@/lib/actions/state";
import { useFieldId } from "@/components/ui/use-field-id";

type Parent = { id: string; kind: string; label: string };

type Props = {
  category?: {
    id: string;
    kind: CategoryKind;
    name: string;
    parentId: string | null;
  };
  /** Top-level categories that may become the parent. */
  parents: Parent[];
  /** Existing categories with subcategories cannot be nested themselves. */
  canHaveParent?: boolean;
};

export function CategoryForm({
  category,
  parents,
  canHaveParent = true,
}: Props) {
  const fid = useFieldId();
  const t = useTranslations("Categories");
  const tKinds = useTranslations("Transactions.kinds");
  const tCommon = useTranslations("Common");
  const locale = useLocale() as Locale;
  const [state, action] = useActionState(
    saveCategory.bind(null, locale, category?.id ?? null),
    initialFormState,
  );
  const { formError, fieldError } = useFormErrors(state);
  const values = state.values ?? {
    name: category?.name ?? "",
    kind: category?.kind ?? "expense",
    parentId: category?.parentId ?? "",
  };
  const [kind, setKind] = useState(values.kind);

  return (
    <form
      key={state.nonce ?? "initial"}
      action={action}
      className="flex flex-col gap-4"
      noValidate
    >
      {formError && <Alert>{formError}</Alert>}
      <div className="grid gap-4 sm:grid-cols-3">
        <Field id={fid("name")} label={t("name")} error={fieldError("name")}>
          <Input
            id={fid("name")}
            name="name"
            maxLength={40}
            defaultValue={values.name}
            required
            aria-invalid={Boolean(fieldError("name"))}
          />
        </Field>
        <Field id={fid("kind")} label={t("kind")}>
          {category && (
            <input type="hidden" name="kind" value={category.kind} />
          )}
          <Select
            id={fid("kind")}
            name={category ? undefined : "kind"}
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            disabled={Boolean(category)}
          >
            {CATEGORY_KINDS.map((value) => (
              <option key={value} value={value}>
                {tKinds(value)}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          id={fid("parentId")}
          label={t("parent")}
          error={fieldError("parentId")}
        >
          <Select
            id={fid("parentId")}
            name="parentId"
            key={kind}
            defaultValue={kind === values.kind ? values.parentId : ""}
            disabled={!canHaveParent}
          >
            <option value="">{t("noParent")}</option>
            {parents
              .filter((p) => p.kind === kind && p.id !== category?.id)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
          </Select>
        </Field>
      </div>
      <div>
        <SubmitButton>{category ? tCommon("save") : t("new")}</SubmitButton>
      </div>
    </form>
  );
}
