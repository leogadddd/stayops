"use client";

import { useCallback, useEffect, useId, useRef, useState, type ComponentType } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAnchoredPopover } from "./use-anchored-popover";

export interface SelectMenuOption<T extends string> {
  value: T;
  label: string;
  /** A short second line shown in the open list. */
  description?: string;
  icon?: ComponentType<{ className?: string }>;
}

/**
 * A styled single-select: a field-shaped button that opens a list of
 * options, with icons and descriptions. Keyboard works like a native
 * select (arrows, Home/End, Enter, Escape, type to jump). Submits the value
 * under `name` when given.
 */
export function SelectMenu<T extends string>({
  id,
  name,
  value,
  onChange,
  options,
  placeholder = "Choose…",
  disabled = false,
  className,
  "aria-label": ariaLabel,
}: {
  id?: string;
  name?: string;
  value: T | "";
  onChange: (value: T) => void;
  options: readonly SelectMenuOption<T>[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const listId = `${fieldId}-list`;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLUListElement>(null);
  const typed = useRef({ text: "", at: 0 });
  const selectedIndex = options.findIndex((option) => option.value === value);
  const selected = options[selectedIndex];

  const close = useCallback(() => setOpen(false), []);
  useAnchoredPopover({ open, onClose: close, wrapperRef, triggerRef, popoverRef, matchWidth: true });

  useEffect(() => {
    if (open) popoverRef.current?.querySelector(`[data-index='${active}']`)?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const openList = () => {
    setActive(Math.max(0, selectedIndex));
    setOpen(true);
  };
  const choose = (index: number) => {
    const option = options[index];
    if (!option) return;
    onChange(option.value);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (disabled) return;
    if (event.key === "Escape" && open) {
      // Close the list without also closing a dialog it sits in.
      event.stopPropagation();
      event.preventDefault();
      setOpen(false);
      return;
    }
    if (event.key === "Tab") {
      setOpen(false);
      return;
    }
    const move = { ArrowDown: 1, ArrowUp: -1 }[event.key];
    if (move !== undefined || event.key === "Home" || event.key === "End") {
      event.preventDefault();
      if (!open) return openList();
      setActive((current) =>
        event.key === "Home" ? 0
          : event.key === "End" ? options.length - 1
            : Math.min(options.length - 1, Math.max(0, current + move!)),
      );
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (open) choose(active);
      else openList();
      return;
    }
    // Type-ahead: jump to the first option starting with what was typed.
    if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
      const now = event.timeStamp;
      typed.current = { text: (now - typed.current.at < 700 ? typed.current.text : "") + event.key.toLowerCase(), at: now };
      const match = options.findIndex((option) => option.label.toLowerCase().startsWith(typed.current.text));
      if (match === -1) return;
      if (open) setActive(match);
      else onChange(options[match]!.value);
    }
  };

  const SelectedIcon = selected?.icon;
  return (
    <div ref={wrapperRef} className={cn("relative", className)} onKeyDown={onKeyDown}>
      {name ? <input type="hidden" name={name} value={value} /> : null}
      <button
        ref={triggerRef}
        id={fieldId}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openList())}
        className={cn(
          "flex h-10 w-full min-w-0 items-center gap-2 rounded-lg border bg-white pl-3 pr-2.5 text-left text-sm text-ink transition-colors",
          "focus:border-pine focus:outline-none focus:ring-2 focus:ring-sage disabled:cursor-not-allowed disabled:opacity-60",
          open ? "border-pine ring-2 ring-sage" : "border-pine/20 hover:border-pine/40",
        )}
      >
        {SelectedIcon ? <SelectedIcon className="h-4 w-4 shrink-0 text-pine/60" /> : null}
        <span className={cn("min-w-0 flex-1 truncate", !selected && "text-ink/40")}>{selected?.label ?? placeholder}</span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-ink/40 transition-transform", open && "rotate-180")} aria-hidden />
      </button>

      {open ? (
        <ul
          ref={popoverRef}
          id={listId}
          popover="manual"
          role="listbox"
          aria-labelledby={fieldId}
          className="fixed inset-auto m-0 max-h-72 max-w-[calc(100vw-1rem)] overflow-y-auto rounded-xl border border-pine/15 bg-white p-1.5 text-ink shadow-xl"
        >
          {options.map((option, index) => {
            const Icon = option.icon;
            const isSelected = option.value === value;
            return (
              <li
                key={option.value}
                id={`${listId}-${index}`}
                data-index={index}
                role="option"
                aria-selected={isSelected}
                onPointerMove={() => setActive(index)}
                onClick={() => choose(index)}
                className={cn(
                  "flex cursor-pointer items-start gap-2.5 rounded-lg px-2.5 py-2 text-sm",
                  index === active ? "bg-pine-mist" : "",
                )}
              >
                {Icon ? (
                  <span className={cn("mt-px flex h-7 w-7 shrink-0 items-center justify-center rounded-md", isSelected ? "bg-pine text-paper" : "bg-sage/50 text-pine")}>
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                ) : null}
                <span className="min-w-0 flex-1">
                  <span className={cn("block whitespace-nowrap", isSelected ? "font-semibold text-pine" : "text-ink")}>{option.label}</span>
                  {option.description ? <span className="block text-xs text-ink/55">{option.description}</span> : null}
                </span>
                {isSelected ? <Check className="mt-1 h-4 w-4 shrink-0 text-pine" aria-hidden /> : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
