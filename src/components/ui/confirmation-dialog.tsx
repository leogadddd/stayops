"use client";

import { useId, useRef, useState, type AriaRole, type ReactNode } from "react";
import { AlertTriangle, X } from "lucide-react";
import { Button, buttonClassName } from "@/components/ui/button";

export function ConfirmationDialog({
  trigger,
  triggerVariant = "ghost",
  triggerSize = "md",
  triggerClassName,
  triggerAriaLabel,
  triggerRole,
  title,
  description,
  confirmLabel,
  cancelLabel = "Go back",
  onConfirm,
  formAction,
}: {
  trigger: ReactNode;
  triggerVariant?: "primary" | "clay" | "outline" | "ghost";
  triggerSize?: "sm" | "md" | "lg";
  triggerClassName?: string;
  triggerAriaLabel?: string;
  triggerRole?: AriaRole;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm?: () => void | Promise<void>;
  formAction?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [pending, setPending] = useState(false);
  const titleId = useId();
  const descriptionId = useId();

  const close = () => {
    if (!pending) dialog.current?.close();
  };
  const confirm = async () => {
    if (!onConfirm) return;
    setPending(true);
    try {
      await onConfirm();
      dialog.current?.close();
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant={triggerVariant}
        size={triggerSize}
        className={triggerClassName}
        aria-label={triggerAriaLabel}
        role={triggerRole}
        onClick={() => dialog.current?.showModal()}
      >
        {trigger}
      </Button>
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onCancel={(event) => {
          if (pending) event.preventDefault();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
        className="fixed left-1/2 top-1/2 m-0 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-pine/15 bg-linen p-0 text-ink shadow-2xl backdrop:bg-pine-deep/55"
      >
        <div className="flex items-start gap-4 p-6">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-clay-mist text-clay-deep">
            <AlertTriangle className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="font-display text-xl text-pine">{title}</h2>
            <p id={descriptionId} className="mt-2 text-sm leading-relaxed text-ink/65">{description}</p>
          </div>
          <button type="button" onClick={close} disabled={pending} aria-label="Close confirmation" className="rounded-md p-1.5 text-ink/45 hover:bg-pine-mist hover:text-pine disabled:opacity-50">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-pine/10 bg-paper/70 px-6 py-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={close} disabled={pending}>{cancelLabel}</Button>
          {formAction ? (
            <form action={formAction} method="post">
              <button type="submit" className={buttonClassName("clay", "md", "w-full")}>{confirmLabel}</button>
            </form>
          ) : (
            <Button type="button" variant="clay" onClick={confirm} disabled={pending}>
              {pending ? "Working…" : confirmLabel}
            </Button>
          )}
        </div>
      </dialog>
    </>
  );
}
