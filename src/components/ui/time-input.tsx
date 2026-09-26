"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAnchoredPopover } from "./use-anchored-popover";

const HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

function parse(value: string) {
  const match = /^(\d{2}):(\d{2})/.exec(value);
  return match ? { hour: Number(match[1]), minute: Number(match[2]) } : null;
}
const pad = (n: number) => String(n).padStart(2, "0");
const format = (hour: number, minute: number) => `${pad(hour)}:${pad(minute)}`;

/** "3:00 PM" from "15:00". */
export function readableTime(value: string) {
  const parts = parse(value);
  if (!parts) return "";
  return `${parts.hour % 12 || 12}:${pad(parts.minute)} ${parts.hour < 12 ? "AM" : "PM"}`;
}

/**
 * A readable time field: shows "3:00 PM" and opens hour, minute and AM/PM
 * columns to pick from. Submits `HH:mm` (24-hour) under `name`. Works
 * controlled (`value`/`onChange`) or uncontrolled (`defaultValue`).
 */
export function TimeInput({
  id,
  name,
  value,
  defaultValue = "",
  onChange,
  step = 5,
  required = false,
  disabled = false,
  placeholder = "Pick a time",
  size = "md",
  className,
  "aria-label": ariaLabel,
}: {
  id?: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  /** Minutes between choices; a current value off the step is still listed. */
  step?: number;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  size?: "md" | "lg";
  className?: string;
  "aria-label"?: string;
}) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const [internal, setInternal] = useState(defaultValue);
  const current = value ?? internal;
  const parts = parse(current);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useAnchoredPopover({ open, onClose: close, wrapperRef, triggerRef, popoverRef });

  const set = (next: string) => {
    if (value === undefined) setInternal(next);
    onChange?.(next);
  };
  // Picking one column before the others starts from 12:00 PM.
  const hour = parts?.hour ?? 12;
  const minute = parts?.minute ?? 0;
  const pm = hour >= 12;
  const stepped = Array.from({ length: Math.ceil(60 / step) }, (_, index) => index * step);
  const minutes = stepped.includes(minute) ? stepped : [...stepped, minute].sort((a, b) => a - b);

  // Bring each column's chosen value into view, and focus the hour.
  useEffect(() => {
    if (!open) return;
    popoverRef.current?.querySelectorAll<HTMLElement>("[aria-selected='true']").forEach((node) => {
      const column = node.parentElement!;
      column.scrollTop = node.offsetTop - column.offsetTop - (column.clientHeight - node.offsetHeight) / 2;
    });
    popoverRef.current?.querySelector<HTMLElement>("[data-column='0'] [aria-selected='true']")?.focus({ preventScroll: true });
  }, [open]);

  const columns = [
    {
      label: "Hour",
      options: HOURS.map((h) => ({ key: h, text: String(h), selected: (hour % 12 || 12) === h, pick: () => set(format((h % 12) + (pm ? 12 : 0), minute)) })),
    },
    {
      label: "Minute",
      options: minutes.map((m) => ({ key: m, text: pad(m), selected: minute === m, pick: () => set(format(hour, m)) })),
    },
    {
      label: "AM or PM",
      options: [
        { key: "AM", text: "AM", selected: !pm, pick: () => set(format(hour % 12, minute)) },
        { key: "PM", text: "PM", selected: pm, pick: () => set(format((hour % 12) + 12, minute)) },
      ],
    },
  ];

  return (
    <div
      ref={wrapperRef}
      className={cn("relative", className)}
      onKeyDown={(event) => {
        if (!open) return;
        if (event.key === "Escape" || event.key === "Enter") {
          // Close without also closing a dialog it sits in, or submitting.
          event.stopPropagation();
          event.preventDefault();
          setOpen(false);
          triggerRef.current?.focus();
          return;
        }
        const target = event.target as HTMLElement;
        const column = Number(target.closest<HTMLElement>("[data-column]")?.dataset.column);
        const index = Number(target.dataset.index);
        if (Number.isNaN(column) || Number.isNaN(index)) return;
        const vertical = { ArrowDown: 1, ArrowUp: -1 }[event.key];
        const horizontal = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
        if (vertical !== undefined) {
          event.preventDefault();
          const options = columns[column]!.options;
          const next = Math.min(options.length - 1, Math.max(0, index + vertical));
          options[next]!.pick();
          requestAnimationFrame(() => popoverRef.current?.querySelector<HTMLElement>(`[data-column='${column}'] [data-index='${next}']`)?.focus());
        } else if (horizontal !== undefined) {
          event.preventDefault();
          const nextColumn = Math.min(2, Math.max(0, column + horizontal));
          popoverRef.current?.querySelector<HTMLElement>(`[data-column='${nextColumn}'] [aria-selected='true']`)?.focus();
        }
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
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className={cn(
          "relative flex w-full min-w-0 items-center gap-2.5 border bg-white px-3 text-left text-sm text-ink transition-colors",
          "focus:border-pine focus:outline-none focus:ring-2 focus:ring-sage disabled:cursor-not-allowed disabled:opacity-60",
          open ? "border-pine ring-2 ring-sage" : "border-pine/20 hover:border-pine/40",
          size === "lg" ? "h-12 rounded-xl" : "h-10 rounded-lg",
        )}
      >
        <Clock className="h-4 w-4 shrink-0 text-pine/50" aria-hidden />
        <span className={cn("min-w-0 truncate tabular-nums", !parts && "text-ink/40")}>{parts ? readableTime(current) : placeholder}</span>
      </button>

      {open ? (
        <div
          ref={popoverRef}
          popover="manual"
          role="dialog"
          aria-label="Choose a time"
          className="fixed inset-auto m-0 rounded-xl border border-pine/15 bg-white p-1.5 text-ink shadow-xl"
        >
          <div className="flex gap-1">
            {columns.map((column, columnIndex) => (
              <div
                key={column.label}
                role="listbox"
                aria-label={column.label}
                data-column={columnIndex}
                className="relative flex max-h-56 w-14 flex-col gap-0.5 overflow-y-auto overscroll-contain [scrollbar-width:none]"
              >
                {column.options.map((option, index) => (
                  <button
                    key={option.key}
                    type="button"
                    role="option"
                    data-index={index}
                    aria-selected={option.selected}
                    tabIndex={option.selected ? 0 : -1}
                    onClick={option.pick}
                    className={cn(
                      "flex h-9 shrink-0 items-center justify-center rounded-lg text-sm tabular-nums transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-clay",
                      option.selected ? "bg-pine font-semibold text-white" : "text-pine hover:bg-pine-mist",
                    )}
                  >
                    {option.text}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
