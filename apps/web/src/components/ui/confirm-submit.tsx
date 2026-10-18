"use client";

import { TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ComponentProps, useId, useRef } from "react";
import { Button } from "./button";
import { SubmitButton } from "./submit-button";

/**
 * A submit button that asks for confirmation in a dialog before the form is
 * sent.
 */
export function ConfirmSubmit({
  message,
  title,
  confirmLabel,
  ...props
}: ComponentProps<typeof SubmitButton> & {
  message: string;
  /** Defaults to "Delete?". */
  title?: string;
  /** Defaults to "Delete". */
  confirmLabel?: string;
}) {
  const t = useTranslations("Common");
  const dialog = useRef<HTMLDialogElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  return (
    <>
      <SubmitButton
        {...props}
        ref={button}
        onClick={(event) => {
          event.preventDefault();
          dialog.current?.showModal();
        }}
      />
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        className="confirm-dialog m-auto w-[min(26rem,calc(100%-2rem))] rounded-2xl border bg-card p-0 text-card-foreground shadow-2xl backdrop:bg-foreground/40 backdrop:backdrop-blur-[2px]"
        // A click on the backdrop lands on the dialog element itself.
        onClick={(event) => {
          if (event.target === event.currentTarget) dialog.current?.close();
        }}
      >
        <div className="flex gap-4 p-5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <TriangleAlert className="size-5" />
          </span>
          <div className="flex min-w-0 flex-col gap-1.5">
            <h2 id={titleId} className="text-base font-semibold">
              {title ?? t("confirmTitle")}
            </h2>
            <p className="text-sm text-muted-foreground">{message}</p>
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t bg-muted/40 px-5 py-3">
          <Button
            type="button"
            variant="outline"
            autoFocus
            onClick={() => dialog.current?.close()}
          >
            {t("cancel")}
          </Button>
          <Button
            type="button"
            className="bg-destructive text-white hover:bg-destructive/90"
            onClick={() => {
              dialog.current?.close();
              const submitter = button.current;
              submitter?.form?.requestSubmit(submitter);
            }}
          >
            {confirmLabel ?? t("delete")}
          </Button>
        </div>
      </dialog>
    </>
  );
}
