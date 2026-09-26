"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";

type DeleteResult = { error?: string; success?: boolean };

export function TableActionsMenu({
  label,
  viewHref,
  editHref,
  deleteLabel,
  deleteDescription,
  deleteSuccessMessage,
  destructiveActionLabel,
  onDelete,
  links = [],
}: {
  label: string;
  viewHref: string;
  editHref?: string;
  deleteLabel?: string;
  deleteDescription?: string;
  deleteSuccessMessage?: string;
  /** Use for safe domain alternatives such as cancelling rather than deleting. */
  destructiveActionLabel?: string;
  onDelete?: () => Promise<DeleteResult>;
  /** Extra actions listed after View, e.g. "Add unit". */
  links?: { href: string; label: string; icon?: ReactNode }[];
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Place the menu below the trigger, right-aligned, flipping above it when
  // there is no room below and keeping it inside the viewport. Runs before
  // paint so the menu never flashes in the wrong spot.
  useLayoutEffect(() => {
    const anchor = trigger.current?.getBoundingClientRect();
    const element = menu.current;
    if (!open || !anchor || !element) return;
    const { width, height } = element.getBoundingClientRect();
    const gap = 6;
    const margin = 8;
    const fitsBelow = anchor.bottom + gap + height <= window.innerHeight - margin;
    const fitsAbove = anchor.top - gap - height >= margin;
    const top = fitsBelow || !fitsAbove
      ? Math.min(anchor.bottom + gap, window.innerHeight - margin - height)
      : anchor.top - gap - height;
    const left = Math.min(Math.max(anchor.right - width, margin), window.innerWidth - margin - width);
    element.style.top = `${Math.max(margin, top)}px`;
    element.style.left = `${left}px`;
    element.style.visibility = "visible";
  }, [open]);

  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLElement>("a, button")?.focus();
    const dismiss = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!menu.current?.contains(target) && !trigger.current?.contains(target)) setOpen(false);
    };
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    const close = () => setOpen(false);
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", keydown);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", keydown);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [open]);

  const menuContent = open ? (
    <div
      ref={menu}
      role="menu"
      aria-label={`Actions for ${label}`}
      className="invisible fixed left-0 top-0 z-50 w-44 overflow-hidden rounded-lg border border-pine/15 bg-linen p-1.5 text-left shadow-xl"
    >
      <Link href={viewHref} role="menuitem" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-pine hover:bg-pine-mist/70" onClick={() => setOpen(false)}>
        <Eye className="h-4 w-4" aria-hidden />View
      </Link>
      {links.map((link) => (
        <Link key={link.href} href={link.href} role="menuitem" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-pine hover:bg-pine-mist/70" onClick={() => setOpen(false)}>
          {link.icon}
          {link.label}
        </Link>
      ))}
      {editHref ? <Link href={editHref} role="menuitem" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-pine hover:bg-pine-mist/70" onClick={() => setOpen(false)}><Pencil className="h-4 w-4" aria-hidden />Edit</Link> : null}
      {onDelete && deleteLabel && deleteDescription ? (
        <ConfirmationDialog
          title={deleteLabel}
          description={deleteDescription}
          confirmLabel={destructiveActionLabel ?? "Delete"}
          successMessage={deleteSuccessMessage ?? `${label} deleted.`}
          onConfirm={async () => {
            const result = await onDelete();
            if (result.error) throw new Error(result.error);
            setOpen(false);
            router.refresh();
          }}
          trigger={<><Trash2 className="h-4 w-4" aria-hidden />{destructiveActionLabel ?? "Delete"}</>}
          triggerRole="menuitem"
          triggerSize="sm"
          triggerClassName="w-full justify-start px-3 text-clay-deep hover:bg-clay-mist/70"
        />
      ) : null}
    </div>
  ) : null;

  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-label={`Open actions for ${label}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-pine hover:bg-pine-mist/70"
      >
        <MoreHorizontal className="h-5 w-5" aria-hidden />
      </button>
      {typeof document !== "undefined" && menuContent ? createPortal(menuContent, document.body) : null}
    </>
  );
}
