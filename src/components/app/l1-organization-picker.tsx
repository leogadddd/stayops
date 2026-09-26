"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronsUpDown, LoaderCircle, Search } from "lucide-react";
import { roleLabel } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { searchOrganizationsAction } from "@/app/(app)/organization-actions";
import type { OrganizationOption } from "./organization-selector";

/** This browser's recent L1 picks, newest first. Never shared or sent anywhere. */
const RECENT_KEY = "stayops:l1-recent-organizations";
const RECENT_LIMIT = 6;

interface PickerItem {
  id: string;
  name: string;
}

function readRecents(): PickerItem[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is PickerItem => typeof item?.id === "string" && typeof item?.name === "string")
      .slice(0, RECENT_LIMIT);
  } catch {
    return [];
  }
}

function rememberRecent(item: PickerItem) {
  try {
    const next = [item, ...readRecents().filter((recent) => recent.id !== item.id)].slice(0, RECENT_LIMIT);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Storage can be blocked (private windows); recents are only a convenience.
  }
}

function Mark({ name, imageSrc, dark }: { name: string; imageSrc?: string | null; dark?: boolean }) {
  return (
    <span aria-hidden className={cn("flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg font-display text-base", dark ? "bg-paper text-pine" : "bg-primary text-white")}>
      {imageSrc ? <img src={imageSrc} alt="" className="h-full w-full object-cover" /> : name.trim().slice(0, 1).toUpperCase()}
    </span>
  );
}

/**
 * The organization switcher for L1 operators: it searches every organization
 * in the app instead of listing them. With nothing typed it shows this
 * browser's recent picks and the operator's own organizations.
 */
export function L1OrganizationPicker({
  organizations,
  activeOrganizationId,
  imageSrc,
  switching,
  tone = "light",
  className,
  onSelect,
}: {
  /** The operator's own memberships, plus the organization they're in. */
  organizations: OrganizationOption[];
  activeOrganizationId: string;
  imageSrc: string | null;
  switching: boolean;
  tone?: "light" | "dark";
  className?: string;
  onSelect: (organizationId: string) => void;
}) {
  const dark = tone === "dark";
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PickerItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [recents, setRecents] = useState<PickerItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const active = organizations.find((organization) => organization.id === activeOrganizationId) ?? organizations[0];
  const memberOf = organizations.filter((organization) => !organization.viaL1);
  const roleFor = (organizationId: string) => memberOf.find((organization) => organization.id === organizationId)?.role;

  useEffect(() => {
    if (!open) return;
    const closeOnOutside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutside);
    return () => document.removeEventListener("pointerdown", closeOnOutside);
  }, [open]);

  // Search as the operator types, ignoring answers to older queries.
  useEffect(() => {
    const search = query.trim();
    if (!search) return;
    let current = true;
    const timer = window.setTimeout(async () => {
      const found = await searchOrganizationsAction(search).catch(() => []);
      if (!current) return;
      setResults(found);
      setSearching(false);
    }, 200);
    return () => {
      current = false;
      window.clearTimeout(timer);
    };
  }, [query]);

  const sections: { label: string; items: PickerItem[] }[] = query.trim()
    ? [{ label: "Results", items: results }]
    : [
        { label: "Recent", items: recents },
        { label: "Your organizations", items: memberOf.filter((organization) => !recents.some((recent) => recent.id === organization.id)) },
      ].filter((section) => section.items.length);
  const items = sections.flatMap((section) => section.items);
  const offsets = sections.map((_, sectionIndex) => sections.slice(0, sectionIndex).reduce((total, section) => total + section.items.length, 0));

  const toggle = () => {
    if (!open) {
      setRecents(readRecents());
      setQuery("");
      setResults([]);
      setSearching(false);
      setActiveIndex(0);
    }
    setOpen(!open);
  };
  const choose = (item: PickerItem) => {
    rememberRecent(item);
    setOpen(false);
    onSelect(item.id);
  };

  return (
    <div ref={root} className={cn("relative min-w-0", className)}>
      <button
        type="button"
        aria-label="Active organization"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-busy={switching}
        disabled={switching}
        onClick={toggle}
        className={cn(
          "flex min-w-0 items-center gap-2.5 rounded-lg p-1.5 pr-2 text-left transition-colors",
          dark ? (open ? "w-full bg-paper/10" : "w-full hover:bg-paper/10") : cn("h-10 w-64 border border-pine/20 bg-surface", open ? "ring-2 ring-sage" : "hover:border-pine/35"),
        )}
      >
        <Mark name={active?.name ?? "?"} imageSrc={imageSrc} dark={dark} />
        <span className="min-w-0 flex-1">
          <span className={cn("block truncate text-sm font-medium leading-tight", dark ? "text-paper" : "text-pine")}>{active?.name ?? "Choose an organization"}</span>
          <span className={cn("block text-[11px]", dark ? "text-paper/60" : "text-ink/55")}>
            {switching ? "Switching…" : active?.viaL1 ? "L1 access" : active ? `${roleLabel(active.role)} · L1` : "L1"}
          </span>
        </span>
        {switching
          ? <LoaderCircle className={cn("h-4 w-4 shrink-0 animate-spin", dark ? "text-paper/70" : "text-pine/60")} aria-hidden />
          : <ChevronsUpDown className={cn("h-4 w-4 shrink-0", dark ? "text-paper/60" : "text-ink/45")} aria-hidden />}
      </button>

      {open ? (
        <div role="dialog" aria-label="Open an organization" className={cn("absolute left-0 top-[calc(100%+0.5rem)] z-40 overflow-hidden rounded-xl border border-pine/15 bg-linen shadow-xl", dark ? "right-0" : "w-80 max-w-[calc(100vw-2rem)]")}>
          <div className="border-b border-pine/10 p-2">
            <label className="sr-only" htmlFor={`${id}-search`}>Search all organizations</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-pine/45" aria-hidden />
              <input
                id={`${id}-search`}
                autoFocus
                value={query}
                role="combobox"
                aria-expanded
                aria-autocomplete="list"
                aria-controls={`${id}-list`}
                aria-activedescendant={items[activeIndex] ? `${id}-item-${activeIndex}` : undefined}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setSearching(Boolean(event.target.value.trim()));
                  if (!event.target.value.trim()) setResults([]);
                  setActiveIndex(0);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setOpen(false);
                  else if (event.key === "ArrowDown") {
                    event.preventDefault();
                    setActiveIndex((current) => Math.min(current + 1, Math.max(0, items.length - 1)));
                  } else if (event.key === "ArrowUp") {
                    event.preventDefault();
                    setActiveIndex((current) => Math.max(current - 1, 0));
                  } else if (event.key === "Enter" && items[activeIndex]) {
                    event.preventDefault();
                    choose(items[activeIndex]);
                  }
                }}
                placeholder="Search all organizations"
                className="h-9 w-full rounded-md border border-pine/15 bg-surface py-1.5 pl-8 pr-8 text-sm placeholder:text-ink/40 focus:border-pine focus:outline-none focus:ring-2 focus:ring-sage"
              />
              {searching ? <LoaderCircle className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-pine/45" aria-hidden /> : null}
            </div>
          </div>
          <div id={`${id}-list`} role="listbox" aria-label="Organizations" className="max-h-80 overflow-y-auto p-2">
            {sections.length === 0 || (query.trim() && !searching && !results.length) ? (
              <p className="px-2.5 py-3 text-sm text-ink/55">
                {query.trim() ? (searching ? "Searching…" : "No organizations match that name.") : "Type a name to open any organization."}
              </p>
            ) : sections.map((section, sectionIndex) => (
              <div key={section.label} role="group" aria-label={section.label} className="mb-1 last:mb-0">
                <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-ink/45">{section.label}</p>
                {section.items.map((item, itemIndex) => {
                  const position = offsets[sectionIndex]! + itemIndex;
                  const selected = item.id === activeOrganizationId;
                  const role = roleFor(item.id);
                  return (
                    <button
                      key={item.id}
                      id={`${id}-item-${position}`}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      disabled={switching}
                      onMouseEnter={() => setActiveIndex(position)}
                      onClick={() => choose(item)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm disabled:opacity-60",
                        selected ? "bg-pine-mist" : "hover:bg-pine-mist/70",
                        position === activeIndex && "ring-1 ring-inset ring-sage",
                      )}
                    >
                      <Mark name={item.name} imageSrc={selected ? imageSrc : null} />
                      <span className="min-w-0 flex-1">
                        <span className={cn("block truncate", selected ? "font-semibold text-pine" : "font-medium text-ink")}>{item.name}</span>
                        <span className="mt-0.5 inline-flex rounded-full bg-sage/45 px-2 py-0.5 text-[11px] font-medium text-pine">{role ? roleLabel(role) : "L1 access"}</span>
                      </span>
                      {selected ? <Check className="h-4 w-4 shrink-0 text-pine" aria-hidden /> : null}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
