"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { TIMEZONE_OPTIONS } from "@/lib/timezones";

export type SearchableSelectOption = {
  value: string;
  label?: string;
  description?: string;
  /** Supply a mark to render an image or initial alongside this option. */
  mark?: string;
  imageSrc?: string | null;
};

function OptionMark({ option }: { option: SearchableSelectOption }) {
  if (!option.mark) return null;
  return (
    <span
      aria-hidden
      className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-md bg-pine font-display text-sm text-paper"
    >
      {option.imageSrc ? (
        <img src={option.imageSrc} alt="" className="h-full w-full object-cover" />
      ) : (
        option.mark.trim().slice(0, 1).toUpperCase()
      )}
    </span>
  );
}

export function SearchableSelect({
  id,
  name,
  value,
  options,
  placeholder,
  searchPlaceholder,
  emptyMessage,
  disabled = false,
  className,
  onValueChange,
}: {
  id: string;
  name: string;
  value: string;
  options: SearchableSelectOption[];
  placeholder: string;
  searchPlaceholder: string;
  emptyMessage: string;
  disabled?: boolean;
  className?: string;
  onValueChange: (value: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [opensUpward, setOpensUpward] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef(new Map<number, HTMLButtonElement>());
  const selected = options.find((option) => option.value === value);
  const matches = useMemo(() => {
    const search = query.trim().toLowerCase();
    return search
      ? options.filter((option) => option.label?.toLowerCase().includes(search) || option.value.toLowerCase().includes(search))
      : options;
  }, [options, query]);

  useEffect(() => {
    if (open) optionRefs.current.get(activeIndex)?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open, matches]);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !menuRef.current) return;
    const spaceBelow = window.innerHeight - triggerRef.current.getBoundingClientRect().bottom;
    setOpensUpward(menuRef.current.offsetHeight > spaceBelow && triggerRef.current.getBoundingClientRect().top > spaceBelow);
  }, [open, matches.length]);

  const close = () => {
    setOpen(false);
    setQuery("");
    setActiveIndex(0);
  };
  const choose = (nextValue: string) => {
    onValueChange(nextValue);
    close();
  };

  return (
    <div className={cn("relative", className)} onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) close();
    }}>
      <input type="hidden" name={name} value={value} />
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-controls={`${id}-options`}
        aria-expanded={open}
        onClick={() => {
          setOpen((wasOpen) => !wasOpen);
          setQuery("");
          setActiveIndex(0);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
            setQuery("");
            setActiveIndex(0);
          }
        }}
        className="flex h-10 w-full items-center justify-between gap-3 rounded-lg border border-pine/20 bg-white px-3 text-left text-sm text-ink disabled:cursor-not-allowed disabled:bg-linen/50 disabled:text-ink/45 focus:border-pine focus:outline-none focus:ring-2 focus:ring-sage"
      >
        <OptionMark option={selected ?? { value: "" }} />
        <span className="min-w-0 flex-1 truncate">{selected?.label ?? selected?.value ?? placeholder}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-pine/55" aria-hidden />
      </button>
      {open ? (
        <div ref={menuRef} id={`${id}-options`} role="listbox" className={cn("absolute z-20 w-full overflow-hidden rounded-lg border border-pine/15 bg-white shadow-lg", opensUpward ? "bottom-full mb-1" : "mt-1")}>
          <div className="border-b border-pine/10 p-2">
            <label className="sr-only" htmlFor={`${id}-search`}>Search options</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-pine/45" aria-hidden />
              <input
                id={`${id}-search`}
                autoFocus
                value={query}
                role="combobox"
                aria-autocomplete="list"
                aria-controls={`${id}-options`}
                aria-activedescendant={matches[activeIndex] ? `${id}-option-${activeIndex}` : undefined}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActiveIndex(0);
                }}
                onKeyDownCapture={(event) => {
                  if (event.key === "Escape") close();
                  else if (event.key === "ArrowDown") {
                    event.preventDefault();
                    setActiveIndex((index) => Math.min(index + 1, Math.max(0, matches.length - 1)));
                  } else if (event.key === "ArrowUp") {
                    event.preventDefault();
                    setActiveIndex((index) => Math.max(index - 1, 0));
                  } else if (event.key === "Enter" && matches[activeIndex]) {
                    event.preventDefault();
                    choose(matches[activeIndex].value);
                  }
                }}
                className="h-9 w-full rounded-md border border-pine/15 bg-linen/40 py-1.5 pl-8 pr-2 text-sm placeholder:text-ink/40 focus:border-pine focus:outline-none focus:ring-2 focus:ring-sage"
                placeholder={searchPlaceholder}
              />
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto p-1">
            {matches.length ? matches.map((option, index) => (
              <button
                key={`${option.value}-${index}`}
                id={`${id}-option-${index}`}
                ref={(element) => {
                  if (element) optionRefs.current.set(index, element);
                  else optionRefs.current.delete(index);
                }}
                type="button"
                role="option"
                aria-selected={option.value === value}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(option.value)}
                className={cn("flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm hover:bg-pine-mist", option.value === value && "bg-pine-mist text-pine", index === activeIndex && "bg-sage/35 ring-1 ring-inset ring-sage")}
              >
                <OptionMark option={option} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{option.label ?? option.value}</span>
                  {option.description ? <span className="block text-xs text-ink/55">{option.description}</span> : null}
                </span>
              </button>
            )) : <p className="px-3 py-2 text-sm text-ink/55">{emptyMessage}</p>}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function TimezonePicker({
  id,
  name,
  defaultValue,
  onValueChange,
}: {
  id: string;
  name: string;
  defaultValue: string;
  required?: boolean;
  onValueChange?: (value: string) => void;
}) {
  const [value, setValue] = useState(defaultValue);
  return <SearchableSelect
    id={id}
    name={name}
    value={value}
    options={TIMEZONE_OPTIONS.map((option) => ({
      value: option.value,
      label: option.value,
      description: option.label.replace(` · ${option.value}`, ""),
    }))}
    placeholder="Select timezone"
    searchPlaceholder="Search timezones"
    emptyMessage="No timezone matches that search."
    onValueChange={(timezone) => {
      setValue(timezone);
      onValueChange?.(timezone);
    }}
  />;
}
