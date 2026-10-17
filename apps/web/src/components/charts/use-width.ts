import { useEffect, useRef, useState } from "react";

/**
 * Width of an element, kept up to date as it resizes. Null until measured,
 * so charts are never drawn at a guessed width (which could overflow).
 */
export function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState<number | null>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.max(240, Math.floor(entry.contentRect.width)));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}
