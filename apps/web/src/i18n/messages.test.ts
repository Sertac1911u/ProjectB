import { DEFAULT_CATEGORIES } from "@projectb/core";
import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import tr from "../../messages/tr.json";

function keys(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) return [prefix];
  return Object.entries(value).flatMap(([key, child]) =>
    keys(child, prefix ? `${prefix}.${key}` : key),
  );
}

describe("messages", () => {
  it("defines the same keys in every language", () => {
    expect(keys(en).sort()).toEqual(keys(tr).sort());
  });

  it("names every default category", () => {
    const keys = Object.values(DEFAULT_CATEGORIES).flatMap((parents) =>
      Object.entries(parents).flatMap(([parent, children]) => [
        parent,
        ...children,
      ]),
    );
    expect(Object.keys(tr.Categories.defaults).sort()).toEqual(keys.sort());
  });
});
