import type { CategoryKind, Locale } from "@projectb/core";
import { Archive, ArchiveRestore } from "lucide-react";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { CategoryForm } from "@/components/finance/category-form";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { setCategoryArchived } from "@/lib/actions/finance";
import { categoryName } from "@/lib/categories";
import { getCategories } from "@/lib/data/finance";
import { isUuid } from "@/lib/ids";

type Params = PageProps<"/[locale]/settings/categories/[id]">["params"];

export default async function EditCategoryPage({ params }: { params: Params }) {
  const t = await getTranslations("Categories");
  return (
    <div className="max-w-3xl">
      <PageHeader title={t("editTitle")} />
      <Suspense
        fallback={<div className="h-64 animate-pulse rounded-xl bg-muted" />}
      >
        <EditCategory params={params} />
      </Suspense>
    </div>
  );
}

async function EditCategory({ params }: { params: Params }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [categories, t, tCommon, locale] = await Promise.all([
    getCategories(),
    getTranslations("Categories"),
    getTranslations("Common"),
    getLocale() as Promise<Locale>,
  ]);
  const category = categories.find((c) => c.id === id);
  if (!category) notFound();
  const archived = Boolean(category.archivedAt);
  const parents = categories
    .filter((c) => !c.parentId && !c.archivedAt)
    .map((c) => ({ id: c.id, kind: c.kind, label: categoryName(c, t) }));

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-6">
        <CategoryForm
          category={{
            id: category.id,
            kind: category.kind as CategoryKind,
            name: categoryName(category, t),
            parentId: category.parentId,
          }}
          parents={parents}
          canHaveParent={!categories.some((c) => c.parentId === category.id)}
        />
      </Card>
      <Card className="flex flex-col gap-3 p-6">
        <p className="text-sm text-muted-foreground">{t("archiveHint")}</p>
        <form
          action={setCategoryArchived.bind(
            null,
            locale,
            category.id,
            !archived,
          )}
        >
          <SubmitButton variant="outline">
            {archived ? <ArchiveRestore /> : <Archive />}
            {archived ? tCommon("restore") : tCommon("archive")}
          </SubmitButton>
        </form>
      </Card>
    </div>
  );
}
