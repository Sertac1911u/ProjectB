"use client";

import type { ComponentProps } from "react";
import { SubmitButton } from "./submit-button";

/** A submit button that asks for confirmation before the form is sent. */
export function ConfirmSubmit({
  message,
  ...props
}: ComponentProps<typeof SubmitButton> & { message: string }) {
  return (
    <SubmitButton
      {...props}
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
    />
  );
}
