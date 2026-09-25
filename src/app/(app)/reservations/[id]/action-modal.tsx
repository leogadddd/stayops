"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

/**
 * A reservation action shown over the reservation page. It is an intercepted
 * route, so closing it (X, Esc, backdrop) steps back to the reservation URL.
 */
export function ReservationActionModal({ title, description, unavailable, children }: {
  title: string;
  description: string;
  unavailable?: string;
  children?: ReactNode;
}) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (dialog.current && !dialog.current.open) dialog.current.showModal();
  }, []);

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onClose={() => router.back()}
      onClick={(event) => { if (event.target === event.currentTarget) dialog.current?.close(); }}
      className="fixed left-1/2 top-1/2 m-0 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-pine/15 bg-white p-0 text-ink shadow-2xl backdrop:bg-pine-deep/55"
    >
      <div className="flex items-start gap-4 border-b border-pine/10 px-6 py-5">
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="font-display text-2xl text-pine">{title}</h2>
          <p id={descriptionId} className="mt-1 text-sm leading-relaxed text-ink/60">{description}</p>
        </div>
        <button type="button" onClick={() => dialog.current?.close()} aria-label="Close" className="rounded-md p-1.5 text-ink/45 hover:bg-pine-mist hover:text-pine">
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <div className="px-6 py-5">
        {unavailable ? <p className="rounded-xl bg-linen px-4 py-3 text-sm text-ink/70" role="status">{unavailable}</p> : children}
      </div>
    </dialog>
  );
}
