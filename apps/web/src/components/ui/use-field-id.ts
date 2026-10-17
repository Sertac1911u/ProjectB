"use client";

import { useId } from "react";

/**
 * Unique element ids per form instance. Next.js keeps recently visited pages
 * mounted (hidden), so plain ids like "name" would repeat in the document and
 * labels could point at a field on a hidden page.
 */
export function useFieldId() {
  const prefix = useId();
  return (name: string) => `${prefix}${name}`;
}
