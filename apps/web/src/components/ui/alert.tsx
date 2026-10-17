import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Alert({
  variant = "error",
  className,
  ...props
}: ComponentProps<"div"> & { variant?: "error" | "success" }) {
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={cn(
        "rounded-md border px-3 py-2.5 text-sm",
        variant === "error"
          ? "border-destructive/30 bg-destructive/5 text-destructive"
          : "border-primary/30 bg-accent text-accent-foreground",
        className,
      )}
      {...props}
    />
  );
}
