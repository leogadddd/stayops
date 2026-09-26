"use client";

import { useEffect, useState, useTransition, type KeyboardEvent } from "react";
import { toast } from "sonner";
import { Check, Plus, Search } from "lucide-react";
import type { AmenityScope } from "@/lib/db/schema";
import { normalizeAmenityName } from "@/lib/amenities";
import { createAmenityAction } from "./actions";
import { amenityIcon } from "./amenity-icons";

export interface AmenityOption {
  id: string;
  name: string;
  icon: string | null;
}


const SEARCH_DEBOUNCE_MS = 200;

/**
 * Toggle cards for choosing amenities, with a debounced search. When nothing
 * matches, Enter adds the typed name to the organization's catalog and
 * selects it. Selected IDs submit as repeated `amenityId` fields.
 */
export function AmenityPicker({ scope, options, defaultSelected = [] }: {
  scope: AmenityScope;
  options: AmenityOption[];
  defaultSelected?: string[];
}) {
  const [items, setItems] = useState(options);
  const [selected, setSelected] = useState(() => new Set(defaultSelected));
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [creating, startCreate] = useTransition();

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const matchesFor = (text: string) => {
    const needle = text.trim().toLowerCase();
    return needle ? items.filter((item) => item.name.toLowerCase().includes(needle)) : items;
  };
  const visible = matchesFor(debouncedQuery);
  const newName = normalizeAmenityName(query);
  const exactMatch = newName ? items.some((item) => item.name.toLowerCase() === newName.toLowerCase()) : false;

  const toggle = (id: string) => setSelected((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const create = () => {
    if (!newName || creating) return;
    startCreate(async () => {
      const result = await createAmenityAction(scope, newName);
      if (!result.amenity) {
        toast.error("Couldn’t add the amenity", { description: result.error });
        return;
      }
      const amenity = result.amenity;
      setItems((current) => current.some((item) => item.id === amenity.id) ? current : [...current, amenity]);
      setSelected((current) => new Set(current).add(amenity.id));
      setQuery("");
      setDebouncedQuery("");
      toast.success(`Added “${amenity.name}”.`);
    });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape" && query) {
      event.preventDefault();
      setQuery("");
      setDebouncedQuery("");
      return;
    }
    if (event.key !== "Enter") return;
    // Enter never submits the surrounding form from the search box.
    event.preventDefault();
    const matches = matchesFor(query);
    if (matches.length === 1) {
      toggle(matches[0]!.id);
      setQuery("");
      setDebouncedQuery("");
    } else if (matches.length === 0) {
      create();
    }
  };

  const searchId = `amenity-search-${scope}`;
  return (
    <div className="space-y-3">
      {[...selected].map((id) => <input key={id} type="hidden" name="amenityId" value={id} />)}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label htmlFor={searchId} className="relative block min-w-0 flex-1 sm:max-w-sm">
          <span className="sr-only">Search amenities</span>
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40" />
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search or add an amenity"
            autoComplete="off"
            maxLength={60}
            className="h-10 w-full rounded-lg border border-pine/20 bg-surface pl-9 pr-3 text-sm outline-none placeholder:text-ink/40 focus:border-pine/40 focus:ring-2 focus:ring-sage"
          />
        </label>
        <span className="text-xs text-ink/55" aria-live="polite">{selected.size} selected</span>
      </div>

      {visible.length ? (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {visible.map((item) => {
            const on = selected.has(item.id);
            const Icon = amenityIcon(item.icon);
            return (
              <li key={item.id}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(item.id)}
                  className={`relative flex h-full w-full items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${on ? "border-pine bg-sage/45 text-pine" : "border-pine/15 bg-surface text-ink/80 hover:border-pine/35 hover:bg-pine-mist/40"}`}
                >
                  <Icon aria-hidden className={`h-4 w-4 shrink-0 ${on ? "text-pine" : "text-ink/45"}`} />
                  <span className="min-w-0 flex-1 break-words leading-tight">{item.name}</span>
                  {on ? <Check aria-hidden className="h-3.5 w-3.5 shrink-0 text-pine" /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {newName && !exactMatch && debouncedQuery === query ? (
        <div className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed border-pine/25 px-3 py-2.5 text-sm ${visible.length ? "" : "bg-paper"}`}>
          <span className="text-ink/65">
            {visible.length ? "Not listed?" : <>No amenities match “{newName}”.</>}{" "}
            {visible.length ? null : <span className="text-ink/45">Press Enter to add it.</span>}
          </span>
          <button type="button" onClick={create} disabled={creating} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium text-pine hover:bg-pine-mist disabled:opacity-50">
            <Plus aria-hidden className="h-4 w-4" />{creating ? "Adding…" : `Add “${newName}”`}
          </button>
        </div>
      ) : null}
    </div>
  );
}
