"use client";

import { Menu, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ReactNode, useRef } from "react";

/** The menu button of small screens; the menu slides in from the side. */
export function MobileMenu({ children }: { children: ReactNode }) {
  const t = useTranslations("Shell");
  const dialog = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        aria-label={t("openMenu")}
        onClick={() => dialog.current?.showModal()}
        className="flex size-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <Menu className="size-5" />
      </button>
      <dialog
        ref={dialog}
        aria-label={t("menu")}
        className="mobile-menu m-0 h-dvh max-h-none w-[min(18rem,85vw)] max-w-none border-r bg-card p-0 text-card-foreground shadow-2xl backdrop:bg-foreground/40"
        onClick={(event) => {
          // The backdrop, and any link inside, closes the menu.
          const target = event.target as HTMLElement;
          if (target === event.currentTarget || target.closest("a")) {
            dialog.current?.close();
          }
        }}
      >
        <div className="flex h-full flex-col gap-4 p-4">
          <button
            type="button"
            aria-label={t("closeMenu")}
            onClick={() => dialog.current?.close()}
            className="flex size-10 items-center justify-center self-end rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-5" />
          </button>
          {children}
        </div>
      </dialog>
    </>
  );
}
