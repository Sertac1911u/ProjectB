import { TRANSACTION_KINDS } from "@projectb/core";
import { SlidersHorizontal } from "lucide-react";
import Form from "next/form";
import { getLocale, getTranslations } from "next-intl/server";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import { categoryName, categoryTree } from "@/lib/categories";
import type { AccountWithBalance, CategoryRow } from "@/lib/data/finance";

export type FilterValues = Partial<
  Record<
    | "q"
    | "kind"
    | "account"
    | "category"
    | "tag"
    | "from"
    | "to"
    | "min"
    | "max",
    string
  >
>;

type Props = {
  values: FilterValues;
  accounts: AccountWithBalance[];
  categories: CategoryRow[];
  tags: { id: string; name: string }[];
};

export async function TransactionFilters({
  values,
  accounts,
  categories,
  tags,
}: Props) {
  const [locale, t, tCategories] = await Promise.all([
    getLocale(),
    getTranslations("Transactions"),
    getTranslations("Categories"),
  ]);
  const active = Object.values(values).some(Boolean);
  const field = "flex flex-col gap-1 text-sm font-medium";

  return (
    <details open={active} className="group mb-4">
      <summary className="mb-3 inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
        <SlidersHorizontal className="size-4" />
        {t("filters.title")}
      </summary>
      <Card className="p-4">
        <Form
          action={`/${locale}/transactions`}
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        >
          <label className={`${field} sm:col-span-2`}>
            {t("filters.search")}
            <Input
              name="q"
              defaultValue={values.q}
              placeholder={t("filters.searchPlaceholder")}
            />
          </label>
          <label className={field}>
            {t("filters.kind")}
            <Select name="kind" defaultValue={values.kind ?? ""}>
              <option value="">{t("filters.all")}</option>
              {TRANSACTION_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {t(`kinds.${kind}`)}
                </option>
              ))}
            </Select>
          </label>
          <label className={field}>
            {t("filters.account")}
            <Select name="account" defaultValue={values.account ?? ""}>
              <option value="">{t("filters.all")}</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </label>
          <label className={field}>
            {t("filters.category")}
            <Select name="category" defaultValue={values.category ?? ""}>
              <option value="">{t("filters.all")}</option>
              {(["expense", "income"] as const).map((kind) => (
                <optgroup key={kind} label={t(`kinds.${kind}`)}>
                  {categoryTree(categories, kind, {
                    includeArchived: true,
                  }).flatMap((parent) => [
                    <option key={parent.id} value={parent.id}>
                      {categoryName(parent, tCategories)}
                    </option>,
                    ...parent.children.map((child) => (
                      <option key={child.id} value={child.id}>
                        {categoryName(parent, tCategories)} ›{" "}
                        {categoryName(child, tCategories)}
                      </option>
                    )),
                  ])}
                </optgroup>
              ))}
            </Select>
          </label>
          <label className={field}>
            {t("filters.tag")}
            <Select name="tag" defaultValue={values.tag ?? ""}>
              <option value="">{t("filters.all")}</option>
              {tags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
                </option>
              ))}
            </Select>
          </label>
          <label className={field}>
            {t("filters.from")}
            <Input type="date" name="from" defaultValue={values.from} />
          </label>
          <label className={field}>
            {t("filters.to")}
            <Input type="date" name="to" defaultValue={values.to} />
          </label>
          <label className={field}>
            {t("filters.minAmount")}
            <Input
              name="min"
              inputMode="decimal"
              defaultValue={values.min}
              placeholder="0,00"
            />
          </label>
          <label className={field}>
            {t("filters.maxAmount")}
            <Input
              name="max"
              inputMode="decimal"
              defaultValue={values.max}
              placeholder="0,00"
            />
          </label>
          <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-2">
            <button type="submit" className={buttonVariants()}>
              {t("filters.apply")}
            </button>
            {active && (
              <Link
                href="/transactions"
                className={buttonVariants({ variant: "ghost" })}
              >
                {t("filters.clear")}
              </Link>
            )}
          </div>
        </Form>
      </Card>
    </details>
  );
}
