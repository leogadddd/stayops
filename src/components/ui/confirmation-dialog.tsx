"use client";

import { useId, useRef, useState, type AriaRole, type ReactNode } from "react";
import { AlertTriangle, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AuthLoadingOverlay } from "@/components/ui/auth-loading-overlay";

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
  successMessage,
  loadingLabel,
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
  successMessage?: string | null;
  /** Optional full-screen status displayed while the action is in flight. */
  loadingLabel?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  const close = () => {
    if (!pending) dialog.current?.close();
  };
  const confirm = async () => {
    if (!onConfirm) return;
    setPending(true);
    setError(null);
    try {
      await onConfirm();
      if (successMessage !== null) {
        toast.success(successMessage ?? `${confirmLabel} completed.`);
      }
      dialog.current?.close();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "That action could not be completed.";
      setError(message);
      toast.error("That didn’t work", { description: message });
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
        onClick={() => {
          setError(null);
          dialog.current?.showModal();
        }}
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
        className="fixed left-1/2 top-1/2 m-0 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-pine/15 bg-linen p-0 text-ink shadow-2xl backdrop:bg-scrim/55"
      >
        <div className="flex items-start gap-4 p-6">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-clay-mist text-clay-deep">
            <AlertTriangle className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="font-display text-xl text-pine">{title}</h2>
            <p id={descriptionId} className="mt-2 text-sm leading-relaxed text-ink/65">{description}</p>
            {error ? <p className="mt-3 rounded-lg bg-clay-mist px-3 py-2 text-sm text-clay-deep" role="alert">{error}</p> : null}
          </div>
          <button type="button" onClick={close} disabled={pending} aria-label="Close confirmation" className="rounded-md p-1.5 text-ink/45 hover:bg-pine-mist hover:text-pine disabled:opacity-50">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-pine/10 bg-paper/70 px-6 py-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={close} disabled={pending}>{cancelLabel}</Button>
          <Button type="button" variant="clay" onClick={confirm} disabled={pending}>
            {pending ? "Working…" : confirmLabel}
          </Button>
        </div>
      </dialog>
      {pending && loadingLabel ? <AuthLoadingOverlay label={loadingLabel} tone="dark" /> : null}
    </>
  );
}
