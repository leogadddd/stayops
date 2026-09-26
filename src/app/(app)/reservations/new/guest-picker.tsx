"use client";

import { useActionState, useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown, Mail, Phone, Search, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label, Select, Textarea } from "@/components/ui/input";
import { searchGuests, type SearchableGuest } from "@/lib/guest-search";
import { GUEST_ID_TYPES, GUEST_ID_TYPE_LABELS } from "@/lib/guests";
import { cn } from "@/lib/utils";
import { createGuestForBookingAction, type QuickGuestState } from "../../guests/actions";
import { GuestAvatar } from "../../guests/guest-display";

/**
 * Pick the primary guest by searching name, email or phone. Nobody is
 * listed until the search matches, so it stays usable with thousands of
 * guests. "New guest" opens a dialog that creates the profile right away.
 */
export function GuestPicker({
  guests,
  value,
  onChange,
  onCreated,
  canCreate,
}: {
  guests: readonly SearchableGuest[];
  value: string;
  onChange: (guestId: string) => void;
  /** A guest the dialog just created; the caller adds it to `guests` and selects it. */
  onCreated: (guest: SearchableGuest) => void;
  /** Adding guests needs guests.create. */
  canCreate: boolean;
}) {
  const selected = guests.find((guest) => guest.id === value);
  const [searching, setSearching] = useState(!selected);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dialogPrefill, setDialogPrefill] = useState<{ key: number; name: string; email: string; phone: string } | null>(null);
  const listId = useId();
  const matches = useMemo(() => searchGuests(guests, query), [guests, query]);
  const trimmed = query.trim();

  function choose(guest: SearchableGuest) {
    onChange(guest.id);
    setQuery("");
    setSearching(false);
  }

  function startSearch() {
    setSearching(true);
    setQuery("");
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  // Put what they typed into the matching field of the new guest.
  function openNewGuest() {
    const text = trimmed;
    const prefill = { key: Date.now(), name: "", email: "", phone: "" };
    if (text.includes("@")) prefill.email = text;
    else if (/^[\d\s()+-]{5,}$/.test(text)) prefill.phone = text;
    else prefill.name = text;
    setDialogPrefill(prefill);
  }

  return (
    <div>
      {selected && !searching ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-pine/15 bg-linen/60 p-3">
          <GuestAvatar name={selected.name} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-pine">{selected.name}</p>
            <p className="mt-0.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-ink/60">
              <span className="inline-flex min-w-0 items-center gap-1"><Mail className="h-3.5 w-3.5 shrink-0" aria-hidden /><span className="truncate">{selected.email || "No email"}</span></span>
              <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5 shrink-0" aria-hidden />{selected.phone || "No phone"}</span>
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={startSearch}>Change guest</Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-start gap-2">
          <div className="relative min-w-0 flex-1 basis-64">
            <label htmlFor="guestSearch" className="sr-only">Search guests</label>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-pine/45" aria-hidden />
            <Input
              ref={inputRef}
              id="guestSearch"
              role="combobox"
              aria-expanded={Boolean(trimmed)}
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={matches[active] ? `${listId}-${matches[active].id}` : undefined}
              autoComplete="off"
              value={query}
              placeholder="Search by name, email or phone"
              className="h-11 pl-9 pr-9"
              onChange={(event) => { setQuery(event.target.value); setActive(0); }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") { event.preventDefault(); setActive((index) => Math.min(index + 1, matches.length - 1)); }
                else if (event.key === "ArrowUp") { event.preventDefault(); setActive((index) => Math.max(index - 1, 0)); }
                else if (event.key === "Enter") { event.preventDefault(); if (matches[active]) choose(matches[active]); }
                else if (event.key === "Escape") {
                  if (query) setQuery("");
                  else if (selected) setSearching(false);
                }
              }}
            />
            {query ? (
              <button type="button" onClick={() => { setQuery(""); inputRef.current?.focus(); }} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-ink/45 hover:bg-pine-mist hover:text-pine">
                <X className="h-4 w-4" aria-hidden />
              </button>
            ) : null}
            {trimmed ? (
              <div className="absolute left-0 right-0 top-full z-20 mt-1.5 overflow-hidden rounded-xl border border-pine/15 bg-surface shadow-xl">
                {matches.length ? (
                  <ul id={listId} role="listbox" aria-label="Matching guests" className="max-h-80 overflow-y-auto p-1.5">
                    {matches.map((guest, index) => (
                      <li
                        key={guest.id}
                        id={`${listId}-${guest.id}`}
                        role="option"
                        aria-selected={index === active}
                        onMouseEnter={() => setActive(index)}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => choose(guest)}
                        className={cn("flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2", index === active ? "bg-pine-mist/70" : "")}
                      >
                        <GuestAvatar name={guest.name} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-pine">{guest.name}</span>
                          <span className="block truncate text-xs text-ink/55">{[guest.email, guest.phone].filter(Boolean).join(" · ") || "No contact details"}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p id={listId} role="status" className="px-4 py-3 text-sm text-ink/60">No guests match “{trimmed}”.</p>
                )}
                {canCreate ? (
                  <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={openNewGuest} className="flex w-full items-center gap-2 border-t border-pine/10 px-4 py-2.5 text-left text-sm font-medium text-clay-deep hover:bg-clay-mist/50">
                    <UserPlus className="h-4 w-4" aria-hidden />
                    Add “{trimmed}” as a new guest
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
          {canCreate ? (
            <Button type="button" variant="outline" className="h-11" onClick={openNewGuest}>
              <UserPlus className="h-4 w-4" aria-hidden />
              New guest
            </Button>
          ) : null}
          {selected ? <Button type="button" variant="ghost" className="h-11" onClick={() => setSearching(false)}>Cancel</Button> : null}
          <p className="basis-full text-xs text-ink/50">
            {guests.length ? `Type to search ${guests.length} ${guests.length === 1 ? "guest" : "guests"}.` : "No guests yet."}
            {canCreate ? " Not there yet? Add them as a new guest." : ""}
          </p>
        </div>
      )}

      {dialogPrefill ? (
        <NewGuestDialog
          key={dialogPrefill.key}
          prefill={dialogPrefill}
          onClose={() => setDialogPrefill(null)}
          onCreated={(guest) => {
            setDialogPrefill(null);
            onCreated(guest);
            setQuery("");
            setSearching(false);
          }}
        />
      ) : null}
    </div>
  );
}

function NewGuestDialog({
  prefill,
  onClose,
  onCreated,
}: {
  prefill: { name: string; email: string; phone: string };
  onClose: () => void;
  onCreated: (guest: SearchableGuest) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [state, formAction, pending] = useActionState<QuickGuestState, FormData>(createGuestForBookingAction, {});

  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (dialog.current && !dialog.current.open) dialog.current.showModal();
    // showModal focuses the first control (the close button); start on the name instead.
    nameRef.current?.focus();
  }, []);
  // Report each created guest once, even if the parent re-renders first.
  const reported = useRef<string | null>(null);
  useEffect(() => {
    if (state.guest && reported.current !== state.guest.id) {
      reported.current = state.guest.id;
      onCreated(state.guest);
    }
  }, [state.guest, onCreated]);

  const close = () => { if (!pending) dialog.current?.close(); };

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={(event) => { if (pending) event.preventDefault(); }}
      onClick={(event) => { if (event.target === event.currentTarget) close(); }}
      className="fixed left-1/2 top-1/2 m-0 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-pine/15 bg-surface p-0 text-ink shadow-2xl backdrop:bg-scrim/55"
    >
      <form action={formAction}>
        <div className="flex items-start gap-4 border-b border-pine/10 px-6 py-5">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="font-display text-2xl text-pine">New guest</h2>
            <p className="mt-1 text-sm text-ink/60">Saved to your guest list and picked for this reservation.</p>
          </div>
          <button type="button" onClick={close} aria-label="Close" className="rounded-md p-1.5 text-ink/45 hover:bg-pine-mist hover:text-pine">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div>
            <Label htmlFor="newGuestName">Full name</Label>
            <Input ref={nameRef} id="newGuestName" name="name" defaultValue={prefill.name} required minLength={2} maxLength={120} autoComplete="off" placeholder="e.g. Maria Santos" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="newGuestEmail">Email</Label>
              <Input id="newGuestEmail" name="email" type="email" defaultValue={prefill.email} required maxLength={200} autoComplete="off" placeholder="guest@example.com" />
            </div>
            <div>
              <Label htmlFor="newGuestPhone">Phone</Label>
              <Input id="newGuestPhone" name="phone" type="tel" defaultValue={prefill.phone} required maxLength={40} autoComplete="off" placeholder="+63 9xx xxx xxxx" />
            </div>
          </div>

          <details className="group rounded-xl border border-pine/10">
            <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium text-pine">
              More details <span className="font-normal text-ink/45">· optional</span>
              <ChevronDown className="ml-auto h-4 w-4 text-pine/50 transition group-open:rotate-180" aria-hidden />
            </summary>
            <div className="grid gap-4 border-t border-pine/10 px-4 py-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="newGuestPreferred">Preferred name</Label>
                <Input id="newGuestPreferred" name="preferredName" maxLength={60} autoComplete="off" />
              </div>
              <div>
                <Label htmlFor="newGuestNationality">Nationality</Label>
                <Input id="newGuestNationality" name="nationality" maxLength={60} autoComplete="off" placeholder="e.g. Filipino" />
              </div>
              <div>
                <Label htmlFor="newGuestIdType">ID type</Label>
                <Select id="newGuestIdType" name="idType" defaultValue="">
                  <option value="">Not recorded</option>
                  {GUEST_ID_TYPES.map((type) => <option key={type} value={type}>{GUEST_ID_TYPE_LABELS[type]}</option>)}
                </Select>
              </div>
              <div>
                <Label htmlFor="newGuestIdNumber">ID number</Label>
                <Input id="newGuestIdNumber" name="idNumber" maxLength={60} autoComplete="off" />
              </div>
              <div>
                <Label htmlFor="newGuestBirthDate">Birth date</Label>
                <Input id="newGuestBirthDate" name="birthDate" type="date" />
              </div>
              <div>
                <Label htmlFor="newGuestCompany">Company</Label>
                <Input id="newGuestCompany" name="company" maxLength={120} autoComplete="off" />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="newGuestNotes">Notes</Label>
                <Textarea id="newGuestNotes" name="notes" maxLength={2000} className="min-h-20" placeholder="Preferences, special requests…" />
              </div>
            </div>
          </details>
          <FieldError message={state.error} />
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-pine/10 px-6 py-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={close} disabled={pending}>Cancel</Button>
          <Button type="submit" variant="clay" disabled={pending}>{pending ? "Adding…" : "Add guest"}</Button>
        </div>
      </form>
    </dialog>
  );
}
