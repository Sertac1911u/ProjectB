"use client";

import { LoaderCircle } from "lucide-react";
import type { ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "./button";

export function SubmitButton({
  children,
  ...props
}: ComponentProps<typeof Button>) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} aria-busy={pending} {...props}>
      {pending && <LoaderCircle className="animate-spin" />}
      {children}
    </Button>
  );
}
