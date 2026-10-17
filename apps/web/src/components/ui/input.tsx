import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const inputClassName =
  "h-10 w-full rounded-md border bg-card px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 aria-invalid:border-destructive aria-invalid:ring-destructive/20 disabled:opacity-50";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(inputClassName, className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return (
    <select className={cn(inputClassName, "pr-8", className)} {...props} />
  );
}
