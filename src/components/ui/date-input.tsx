"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { addDaysLocal, readableDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

const MONTH_LABEL = new Intl.DateTimeFormat("en-PH", { month: "long", year: "numeric", timeZone: "UTC" });
const DAY_NAMES = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function browserToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
// Today only exists in the browser, so the server render uses the plain
// weekday form and the client adds "Today"/"Tomorrow" without a mismatch.
const subscribeDay = (callback: () => void) => {
  const timer = setInterval(callback, 60_000);
  return () => clearInterval(timer);
};
const noToday = () => null;

function shiftMonth(month: string, delta: number) {
  const [year, m] = month.split("-").map(Number);
  const value = new Date(Date.UTC(year!, m! - 1 + delta, 1));
  return value.toISOString().slice(0, 7);
}

/** Sunday-first weeks covering the month, including neighbouring days. */
function monthGrid(month: string): string[] {
  const first = `${month}-01`;
  const start = addDaysLocal(first, -new Date(`${first}T00:00:00Z`).getUTCDay());
  return Array.from({ length: 42 }, (_, index) => addDaysLocal(start, index));
}

/**
 * A readable date field: shows "Today, Sep 24, 2026" or "Mon, Sep 28, 2026"
 * instead of the browser's mm/dd/yyyy, and opens a month calendar to pick.
 * Submits `YYYY-MM-DD` under `name`. Works controlled (`value`/`onChange`)
 * or uncontrolled (`defaultValue`).
 */
export function DateInput({
  id,
  name,
  value,
  defaultValue = "",
  onChange,
  min,
  max,
  today: todayProp,
  required = false,
  clearable = false,
  placeholder = "Pick a date",
  size = "md",
  className,
  "aria-label": ariaLabel,
}: {
  id?: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  min?: string;
  max?: string;
  /** "Today" in the relevant timezone (e.g. the property's); defaults to the browser's. */
  today?: string;
  required?: boolean;
  /** Show a clear button, for optional filters. */
  clearable?: boolean;
  placeholder?: string;
  size?: "md" | "lg";
  className?: string;
  "aria-label"?: string;
}) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const [internal, setInternal] = useState(defaultValue);
  const current = value ?? internal;
  const browserDay = useSyncExternalStore(subscribeDay, browserToday, noToday);
  const today = todayProp ?? browserDay;
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState((current || today || browserToday()).slice(0, 7));
  const wrapperRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const set = (next: string) => {
    if (value === undefined) setInternal(next);
    onChange?.(next);
  };
  const allowed = (date: string) => (!min || date >= min) && (!max || date <= max);

  // The calendar opens as a popover in the browser's top layer, so it sits
  // above modals and is never clipped by a scrolling container. It is placed
  // under the field, or above it when there is no room below.
  useLayoutEffect(() => {
    const popover = popoverRef.current;
    const trigger = triggerRef.current;
    if (!open || !popover || !trigger) return;
    popover.showPopover?.();
    const place = () => {
      const rect = trigger.getBoundingClientRect();
      const width = popover.offsetWidth;
      const height = popover.offsetHeight;
      const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
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
  }, [open, month]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    // Put focus on the chosen day (or today) so arrow keys work straight away.
    gridRef.current?.querySelector<HTMLButtonElement>("[data-focus='true']")?.focus();
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  const openCalendar = () => {
    setMonth((current || today || browserToday()).slice(0, 7));
    setOpen(true);
  };
  const choose = (date: string) => {
    if (!allowed(date)) return;
    set(date);
    setOpen(false);
  };
  const focusDate = current && current.startsWith(month) ? current : today && today.startsWith(month) ? today : `${month}-01`;

  return (
    <div
      ref={wrapperRef}
      className={cn("relative", className)}
      onKeyDown={(event) => {
        if (event.key !== "Escape" || !open) return;
        // Close the calendar without also closing a dialog it sits in.
        event.stopPropagation();
        event.preventDefault();
        setOpen(false);
      }}
    >
      {/* Carries the value and native "required" validation for the form. */}
      {name ? (
        <input
          tabIndex={-1}
          aria-hidden
          name={name}
          value={current}
          required={required}
          onChange={() => {}}
          className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
        />
      ) : null}
      <button
        ref={triggerRef}
        id={fieldId}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => (open ? setOpen(false) : openCalendar())}
        className={cn(
          "relative flex w-full min-w-0 items-center gap-2.5 border border-pine/20 bg-white pl-3 pr-9 text-left text-sm text-ink transition-colors hover:border-pine/40 focus:border-pine focus:outline-none focus:ring-2 focus:ring-sage",
          size === "lg" ? "h-12 rounded-xl" : "h-10 rounded-lg",
        )}
      >
        <CalendarDays className="h-4 w-4 shrink-0 text-pine/50" aria-hidden />
        <span className={cn("min-w-0 truncate", !current && "text-ink/40")}>
          {current ? readableDate(current, today) : placeholder}
        </span>
      </button>
      {clearable && current ? (
        <button
          type="button"
          onClick={() => set("")}
          aria-label="Clear date"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-ink/40 hover:bg-pine-mist hover:text-pine"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      ) : null}

      {open ? (
        <div
          ref={popoverRef}
          popover="manual"
          role="dialog"
          aria-label="Choose a date"
          className="fixed inset-auto m-0 w-72 rounded-xl border border-pine/15 bg-white p-3 text-ink shadow-xl"
        >
          <div className="mb-2 flex items-center justify-between">
            <button type="button" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month" className="rounded-md p-1.5 text-pine hover:bg-pine-mist">
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </button>
            <p className="text-sm font-medium text-pine" aria-live="polite">
              {MONTH_LABEL.format(new Date(`${month}-01T00:00:00Z`))}
            </p>
            <button type="button" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Next month" className="rounded-md p-1.5 text-pine hover:bg-pine-mist">
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
          <div className="grid grid-cols-7 text-center text-[10px] font-semibold uppercase tracking-wider text-ink/40">
            {DAY_NAMES.map((day) => (
              <span key={day} className="py-1">{day}</span>
            ))}
          </div>
          <div
            ref={gridRef}
            role="grid"
            className="grid grid-cols-7 gap-0.5"
            onKeyDown={(event) => {
              const target = event.target as HTMLElement;
              const date = target.dataset.date;
              const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[event.key];
              if (!date || step === undefined) return;
              event.preventDefault();
              const next = addDaysLocal(date, step);
              if (!next.startsWith(month)) setMonth(next.slice(0, 7));
              requestAnimationFrame(() => gridRef.current?.querySelector<HTMLButtonElement>(`[data-date='${next}']`)?.focus());
            }}
          >
            {monthGrid(month).map((date) => {
              const inMonth = date.startsWith(month);
              const selected = date === current;
              const isToday = date === today;
              const disabled = !allowed(date);
              return (
                <button
                  key={date}
                  type="button"
                  data-date={date}
                  data-focus={date === focusDate}
                  tabIndex={date === focusDate ? 0 : -1}
                  disabled={disabled}
                  aria-pressed={selected}
                  aria-label={readableDate(date, today)}
                  onClick={() => choose(date)}
                  className={cn(
                    "flex h-9 items-center justify-center rounded-lg text-sm tabular-nums transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-clay",
                    selected
                      ? "bg-pine font-semibold text-white"
                      : isToday
                        ? "font-semibold text-clay-deep ring-1 ring-inset ring-clay/40 hover:bg-clay-mist"
                        : inMonth
                          ? "text-pine hover:bg-pine-mist"
                          : "text-ink/30 hover:bg-pine-mist/60",
                    disabled && "cursor-not-allowed opacity-30 hover:bg-transparent",
                  )}
                >
                  {Number(date.slice(8))}
                </button>
              );
            })}
          </div>
          {today ? (
            <div className="mt-2 flex items-center justify-between border-t border-pine/10 pt-2">
              <div className="flex gap-1">
                {[
                  { label: "Today", date: today },
                  { label: "Tomorrow", date: addDaysLocal(today, 1) },
                ].map((option) => (
                  <button
                    key={option.label}
                    type="button"
                    disabled={!allowed(option.date)}
                    onClick={() => choose(option.date)}
                    className="rounded-full border border-pine/15 px-2.5 py-1 text-xs font-medium text-pine hover:border-pine/35 disabled:opacity-35"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              {clearable && current ? (
                <button type="button" onClick={() => { set(""); setOpen(false); }} className="text-xs text-ink/50 hover:text-clay-deep">
                  Clear
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
