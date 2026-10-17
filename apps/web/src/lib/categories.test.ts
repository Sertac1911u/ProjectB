import { describe, expect, it } from "vitest";
import { categoryName, categoryTree } from "./categories";

type Row = {
  id: string;
  kind: string;
  parentId: string | null;
  systemKey: string | null;
  name: string | null;
  archivedAt: Date | null;
};

const cat = (id: string, extra: Partial<Row> = {}): Row => ({
  id,
  kind: "expense",
  parentId: null,
  systemKey: null,
  name: id,
  archivedAt: null,
  ...extra,
});

describe("categoryName", () => {
  const t = (key: string) => `t:${key}`;
  it("prefers the custom name over the translated default", () => {
    expect(categoryName(cat("x", { systemKey: "fuel", name: null }), t)).toBe(
      "t:defaults.fuel",
    );
    expect(
      categoryName(cat("x", { systemKey: "fuel", name: "Benzin" }), t),
    ).toBe("Benzin");
  });
});

describe("categoryTree", () => {
  const list = [
    cat("transport"),
    cat("fuel", { parentId: "transport" }),
    cat("taxi", { parentId: "transport", archivedAt: new Date() }),
    cat("old", { archivedAt: new Date() }),
    cat("salary", { kind: "income" }),
  ];

  it("nests children under parents and hides archived categories", () => {
    const tree = categoryTree(list, "expense");
    expect(tree.map((p) => [p.id, p.children.map((c) => c.id)])).toEqual([
      ["transport", ["fuel"]],
    ]);
  });

  it("keeps an archived category that is currently selected", () => {
    const tree = categoryTree(list, "expense", { keepId: "taxi" });
    expect(tree[0]?.children.map((c) => c.id)).toEqual(["fuel", "taxi"]);
  });

  it("can include everything", () => {
    expect(
      categoryTree(list, "expense", { includeArchived: true }).map((p) => p.id),
    ).toEqual(["transport", "old"]);
  });
});
