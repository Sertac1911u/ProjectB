import type { Locale } from "@projectb/core";
import { ChevronRight, X } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { CategoryForm } from "@/components/finance/category-form";
import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ConfirmSubmit } from "@/components/ui/confirm-submit";
import { Link } from "@/i18n/navigation";
import { deleteTag } from "@/lib/actions/finance";
import { categoryName, categoryTree } from "@/lib/categories";
import { type CategoryRow, getCategories, getTags } from "@/lib/data/finance";

export default async function CategoriesPage() {
  const t = await getTranslations("Categories");
  return (
    <div className="max-w-3xl">
      <PageHeader title={t("title")} description={t("description")} />
      <Suspense
        fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}
      >
        <Categories />
      </Suspense>
    </div>
  );
}

async function Categories() {
  const [categories, tags, t, tCommon, locale] = await Promise.all([
    getCategories(),
    getTags(),
    getTranslations("Categories"),
    getTranslations("Common"),
    getLocale() as Promise<Locale>,
  ]);
  const parents = categories
    .filter((c) => !c.parentId && !c.archivedAt)
    .map((c) => ({ id: c.id, kind: c.kind, label: categoryName(c, t) }));
  const archived = categories.filter(
    (c) => c.archivedAt && !(c.parentId && isArchivedParent(c, categories)),
  );

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{t("new")}</CardTitle>
        </CardHeader>
        <CardContent>
          <CategoryForm parents={parents} />
        </CardContent>
      </Card>

      {(["expense", "income"] as const).map((kind) => (
        <Card key={kind}>
          <CardHeader>
            <CardTitle>{t(kind)}</CardTitle>
          </CardHeader>
          <ul className="divide-y border-t">
            {categoryTree(categories, kind).map((parent) => (
              <li key={parent.id}>
                <CategoryLink
                  category={parent}
                  label={categoryName(parent, t)}
                />
                {parent.children.length > 0 && (
                  <ul className="divide-y border-t bg-muted/30">
                    {parent.children.map((child) => (
                      <li key={child.id}>
                        <CategoryLink
                          category={child}
                          label={categoryName(child, t)}
                          nested
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </Card>
      ))}

      {archived.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
            {t("archived")} ({archived.length})
          </summary>
          <Card className="mt-3">
            <ul className="divide-y">
              {archived.map((category) => (
                <li key={category.id}>
                  <CategoryLink
                    category={category}
                    label={categoryName(category, t)}
                  />
                </li>
              ))}
            </ul>
          </Card>
        </details>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("tagsTitle")}</CardTitle>
          <CardDescription>{t("tagsDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          {tags.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noTags")}</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <li key={tag.id}>
                  <form
                    action={deleteTag.bind(null, locale, tag.id)}
                    className="flex items-center gap-1 rounded-full border py-0.5 pr-1 pl-3 text-sm"
                  >
                    {tag.name}
                    <ConfirmSubmit
                      variant="ghost"
                      size="sm"
                      message={tCommon("confirmDelete")}
                      aria-label={`${tCommon("delete")}: ${tag.name}`}
                      className="size-6 rounded-full p-0"
                    >
                      <X />
                    </ConfirmSubmit>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function isArchivedParent(category: CategoryRow, all: CategoryRow[]) {
  return Boolean(all.find((c) => c.id === category.parentId)?.archivedAt);
}

function CategoryLink({
  category,
  label,
  nested = false,
}: {
  category: CategoryRow;
  label: string;
  nested?: boolean;
}) {
  return (
    <Link
      href={`/settings/categories/${category.id}`}
      className={`flex items-center justify-between px-5 py-2.5 text-sm hover:bg-muted/60 ${nested ? "pl-10" : "font-medium"}`}
    >
      {label}
      <ChevronRight className="size-4 text-muted-foreground" />
    </Link>
  );
}
