"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { ImagePlus, RotateCcw } from "lucide-react";
import { Button, buttonClassName } from "@/components/ui/button";
import { FieldError, Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { UnitPhoto } from "../calendar/availability/stay-display";

/** A white panel for one part of a property or unit form. */
export function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-pine/10 bg-white p-5 shadow-[0_1px_2px_rgba(32,58,53,0.06)] sm:p-6">
      <h2 className="font-display text-xl text-pine">{title}</h2>
      {description ? <p className="mt-1 text-sm text-ink/55">{description}</p> : null}
      <div className="mt-5">{children}</div>
    </section>
  );
}

/** Main sections on the left, a sticky preview and save panel on the right. */
export function FormLayout({ children, aside }: { children: ReactNode; aside: ReactNode }) {
  return (
    <div className="grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="min-w-0 space-y-6">{children}</div>
      <aside className="min-w-0 lg:sticky lg:top-0">{aside}</aside>
    </div>
  );
}

/**
 * The sticky side panel: a live preview card, then the error and the save
 * and cancel buttons, so saving is always in reach on long forms.
 */
export function FormAside({
  preview,
  error,
  pending,
  submitLabel,
  pendingLabel,
  cancelHref,
  note,
}: {
  preview: ReactNode;
  error?: string;
  pending: boolean;
  submitLabel: string;
  pendingLabel: string;
  cancelHref: string;
  note?: string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-pine/10 bg-white shadow-[0_1px_2px_rgba(32,58,53,0.06)]">
      {preview}
      <div className="space-y-3 border-t border-pine/10 p-5">
        <FieldError message={error} />
        <Button type="submit" variant="clay" size="lg" className="w-full" disabled={pending}>
          {pending ? pendingLabel : submitLabel}
        </Button>
        <Link href={cancelHref} className={buttonClassName("ghost", "md", "w-full")}>
          Cancel
        </Link>
        {note ? <p className="text-center text-xs text-ink/50">{note}</p> : null}
      </div>
    </div>
  );
}

/**
 * Cover photo picker with a preview. The chosen file submits as `image`;
 * leaving it alone keeps the current photo.
 */
export function PhotoField({
  currentSrc,
  onPreview,
}: {
  currentSrc: string | null;
  /** Reports the photo to show in the live preview. */
  onPreview?: (src: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState("");
  const shown = selected ?? currentSrc;

  useEffect(() => {
    onPreview?.(shown);
  }, [shown, onPreview]);
  useEffect(() => () => {
    if (selected) URL.revokeObjectURL(selected);
  }, [selected]);

  return (
    <div className="flex flex-wrap items-center gap-5">
      <UnitPhoto src={shown} className="aspect-[4/3] w-44 shrink-0 rounded-xl border border-pine/10" />
      <div className="min-w-0 space-y-2">
        <input
          ref={inputRef}
          id="photo"
          name="image"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 4 * 1024 * 1024) {
              setError("Choose a JPG, PNG, or WebP image up to 4 MB.");
              event.target.value = "";
              return;
            }
            setError("");
            setSelected(URL.createObjectURL(file));
          }}
        />
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => inputRef.current?.click()}>
            <ImagePlus className="h-4 w-4" aria-hidden />
            {shown ? "Replace photo" : "Add photo"}
          </Button>
          {selected ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setSelected(null);
                if (inputRef.current) inputRef.current.value = "";
              }}
            >
              <RotateCcw className="h-4 w-4" aria-hidden />
              {currentSrc ? "Keep current" : "Clear"}
            </Button>
          ) : null}
        </div>
        <p className="text-xs text-ink/50">JPG, PNG, or WebP · up to 4 MB.</p>
        {error ? <p className="text-xs text-clay-deep" role="alert">{error}</p> : null}
      </div>
    </div>
  );
}

/** A peso amount input with a ₱ prefix. */
export function PesoInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink/45">₱</span>
      <Input inputMode="decimal" {...props} className={cn("pl-7 tabular-nums", props.className)} />
    </div>
  );
}

/**
 * The form's current text values, refreshed on every edit, for the live
 * preview. Read from the DOM so inputs stay uncontrolled.
 */
export function useFormValues(formRef: RefObject<HTMLFormElement | null>) {
  const [values, setValues] = useState<Record<string, string>>({});
  const read = useCallback(() => {
    const form = formRef.current;
    if (!form) return;
    const next: Record<string, string> = {};
    for (const [key, value] of new FormData(form)) {
      if (typeof value === "string" && !(key in next)) next[key] = value;
    }
    setValues(next);
  }, [formRef]);
  useEffect(() => {
    read();
  }, [read]);
  return { values, read };
}
