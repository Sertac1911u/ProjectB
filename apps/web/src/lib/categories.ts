import type { Messages } from "next-intl";

type CategoryLike = {
  id: string;
  kind: string;
  parentId: string | null;
  systemKey: string | null;
  name: string | null;
  archivedAt: Date | null;
};

type DefaultKey = keyof Messages["Categories"]["defaults"];
type Translate = (key: `defaults.${DefaultKey}`) => string;

/** Custom name if the user renamed it, otherwise the translated default. */
export function categoryName(
  category: Pick<CategoryLike, "name" | "systemKey">,
  t: Translate,
): string {
  if (category.name) return category.name;
  return category.systemKey
    ? t(`defaults.${category.systemKey as DefaultKey}`)
    : "";
}

/** "Transport › Fuel" for subcategories, the plain name otherwise. */
export function categoryPath(
  category: Pick<CategoryLike, "name" | "systemKey" | "parentId">,
  categories: Pick<CategoryLike, "id" | "name" | "systemKey">[],
  t: Translate,
): string {
  const name = categoryName(category, t);
  const parent = category.parentId
    ? categories.find((c) => c.id === category.parentId)
    : undefined;
  return parent ? `${categoryName(parent, t)} › ${name}` : name;
}

export type CategoryNode<C extends CategoryLike> = C & { children: C[] };

/**
 * Groups categories of one kind into parents with their children, keeping
 * the stored order. Archived ones are left out unless `keepId` is one of them.
 */
export function categoryTree<C extends CategoryLike>(
  categories: C[],
  kind: string,
  {
    includeArchived = false,
    keepId,
  }: { includeArchived?: boolean; keepId?: string | null } = {},
): CategoryNode<C>[] {
  const visible = (c: C) => includeArchived || !c.archivedAt || c.id === keepId;
  const ofKind = categories.filter((c) => c.kind === kind);
  return ofKind
    .filter(
      (c) =>
        !c.parentId &&
        (visible(c) ||
          ofKind.some((x) => x.parentId === c.id && x.id === keepId)),
    )
    .map((parent) => ({
      ...parent,
      children: ofKind.filter((c) => c.parentId === parent.id && visible(c)),
    }));
}
