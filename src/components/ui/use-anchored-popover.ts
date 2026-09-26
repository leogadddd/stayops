"use client";

import { useEffect, useLayoutEffect, type RefObject } from "react";

/**
 * Shows `popoverRef` in the browser's top layer, so it sits above modals and
 * is never clipped by a scrolling container, placed under `triggerRef` (or
 * above it when there's no room below). Pointer-downs outside `wrapperRef`
 * call `onClose`.
 */
export function useAnchoredPopover({ open, onClose, wrapperRef, triggerRef, popoverRef, matchWidth = false, align = "start" }: {
  open: boolean;
  onClose: () => void;
  wrapperRef: RefObject<HTMLElement | null>;
  triggerRef: RefObject<HTMLElement | null>;
  popoverRef: RefObject<HTMLElement | null>;
  /** Make the popover at least as wide as the trigger. */
  matchWidth?: boolean;
  /** Line up the popover's left edge with the trigger's ("start"), or its right edge ("end"). */
  align?: "start" | "end";
}) {
  useLayoutEffect(() => {
    const popover = popoverRef.current;
    const trigger = triggerRef.current;
    if (!open || !popover || !trigger) return;
    popover.showPopover?.();
    const place = () => {
      const rect = trigger.getBoundingClientRect();
      if (matchWidth) popover.style.minWidth = `${rect.width}px`;
      const width = popover.offsetWidth;
      const height = popover.offsetHeight;
      const anchor = align === "end" ? rect.right - width : rect.left;
      const left = Math.min(Math.max(8, anchor), window.innerWidth - width - 8);
      const fitsBelow = window.innerHeight - rect.bottom >= height + 12;
      const top = fitsBelow || rect.top < height + 12 ? rect.bottom + 6 : rect.top - height - 6;
      popover.style.left = `${left}px`;
      popover.style.top = `${Math.max(8, top)}px`;
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      if (popover.isConnected) popover.hidePopover?.();
    };
  }, [open, matchWidth, align, popoverRef, triggerRef]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) onClose();
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open, onClose, wrapperRef]);
}
