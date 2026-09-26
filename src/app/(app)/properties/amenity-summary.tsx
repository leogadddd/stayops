"use client";

import Link from "next/link";
import { useId, useRef } from "react";
import { Pencil, X } from "lucide-react";
import { buttonClassName } from "@/components/ui/button";
import { AmenityList } from "./amenity-icons";

const PREVIEW_COUNT = 5;

type Amenity = { id: string; name: string; icon: string | null };

/**
 * The first few amenities as chips, a "Show all" button that opens the full
 * list in a dialog, and an Edit link. Renders nothing when there are none.
 */
export function AmenitySummary({ amenities, editHref }: { amenities: Amenity[]; editHref: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  if (!amenities.length) return null;
  const hidden = amenities.length - PREVIEW_COUNT;

  return (
    <div className="mt-4 border-t border-pine/10 pt-4">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-ink/45">Amenities</p>
        <Link href={editHref} className="text-xs font-medium text-clay-deep hover:underline">
          Edit
        </Link>
      </div>
      <AmenityList amenities={amenities.slice(0, PREVIEW_COUNT)} emptyLabel="" />
      {hidden > 0 ? (
        <button
          type="button"
          onClick={() => dialog.current?.showModal()}
          className="mt-2 text-xs font-medium text-pine underline-offset-4 hover:text-clay-deep hover:underline"
        >
          Show all {amenities.length} amenities
        </button>
      ) : null}

      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        onClick={(event) => {
          if (event.target === event.currentTarget) dialog.current?.close();
        }}
        className="fixed left-1/2 top-1/2 m-0 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-pine/15 bg-white p-0 text-ink shadow-2xl backdrop:bg-pine-deep/55"
      >
        <div className="flex items-start gap-4 border-b border-pine/10 px-6 py-5">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="font-display text-2xl text-pine">Amenities</h2>
            <p className="mt-1 text-sm text-ink/60">{amenities.length} included with this unit.</p>
          </div>
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            aria-label="Close"
            className="rounded-md p-1.5 text-ink/45 hover:bg-pine-mist hover:text-pine"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <div className="px-6 py-5">
          <AmenityList amenities={amenities} emptyLabel="" />
        </div>
        <div className="flex justify-end gap-2 border-t border-pine/10 px-6 py-4">
          <button type="button" onClick={() => dialog.current?.close()} className={buttonClassName("ghost", "md")}>
            Close
          </button>
          <Link href={editHref} className={buttonClassName("outline", "md")}>
            <Pencil className="h-4 w-4" aria-hidden />
            Edit amenities
          </Link>
        </div>
      </dialog>
    </div>
  );
}
