"use client";

import { useEffect, useRef, useState } from "react";
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
  onDelete,
}: {
  label: string;
  viewHref: string;
  editHref?: string;
  deleteLabel?: string;
  deleteDescription?: string;
  deleteSuccessMessage?: string;
  onDelete?: () => Promise<DeleteResult>;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, right: 0 });
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const show = () => {
    const rect = trigger.current?.getBoundingClientRect();
    if (rect) {
      setPosition({ top: rect.bottom + 6, right: Math.max(8, window.innerWidth - rect.right) });
    }
    setOpen(true);
  };

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
      className="fixed z-50 w-44 overflow-hidden rounded-lg border border-pine/15 bg-linen p-1.5 text-left shadow-xl"
      style={position}
    >
      <Link href={viewHref} role="menuitem" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-pine hover:bg-pine-mist/70" onClick={() => setOpen(false)}>
        <Eye className="h-4 w-4" aria-hidden />View
      </Link>
      {editHref ? <Link href={editHref} role="menuitem" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-pine hover:bg-pine-mist/70" onClick={() => setOpen(false)}><Pencil className="h-4 w-4" aria-hidden />Edit</Link> : null}
      {onDelete && deleteLabel && deleteDescription ? (
        <ConfirmationDialog
          title={deleteLabel}
          description={deleteDescription}
          confirmLabel="Delete"
          successMessage={deleteSuccessMessage ?? `${label} deleted.`}
          onConfirm={async () => {
            const result = await onDelete();
            if (result.error) throw new Error(result.error);
            setOpen(false);
            router.refresh();
          }}
          trigger={<><Trash2 className="h-4 w-4" aria-hidden />Delete</>}
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
        onClick={() => open ? setOpen(false) : show()}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-pine hover:bg-pine-mist/70"
      >
        <MoreHorizontal className="h-5 w-5" aria-hidden />
      </button>
      {typeof document !== "undefined" && menuContent ? createPortal(menuContent, document.body) : null}
    </>
  );
}
