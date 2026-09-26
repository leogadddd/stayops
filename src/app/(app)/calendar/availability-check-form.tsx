"use client";

import { DateInput } from "@/components/ui/date-input";
import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError, Label } from "@/components/ui/input";
import { addDaysLocal, nightsBetween } from "@/lib/dates";
import { cn } from "@/lib/utils";

const DAY_LABEL = new Intl.DateTimeFormat("en-PH", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

function dayLabel(date: string) {
  return DAY_LABEL.format(new Date(`${date}T00:00:00Z`));
}

/** Quick date ranges, computed from the property's local today. */
function presets(today: string) {
  const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();
  const friday = addDaysLocal(today, (5 - weekday + 7) % 7);
  return [
    { label: "Tonight", checkIn: today, checkOut: addDaysLocal(today, 1) },
    { label: "Tomorrow", checkIn: addDaysLocal(today, 1), checkOut: addDaysLocal(today, 2) },
    { label: "This weekend", checkIn: friday, checkOut: addDaysLocal(friday, 2) },
    { label: "Next 7 nights", checkIn: today, checkOut: addDaysLocal(today, 7) },
  ];
}

/**
 * The search bar. Searching navigates to `?checkIn=…&checkOut=…&guests=…` so
 * results survive back/forward and can be shared; the server renders them
 * as `children`, which are swapped for placeholders while a search loads.
 */
export function AvailabilityCheckForm({ today, defaults, error, children }: {
  today: string;
  defaults: { checkIn: string; checkOut: string; guestCount: number };
  error?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [guestCount, setGuestCount] = useState(defaults.guestCount);
  const [checkIn, setCheckIn] = useState(defaults.checkIn);
  const [checkOut, setCheckOut] = useState(defaults.checkOut);

  const nights = checkIn && checkOut && checkOut > checkIn ? nightsBetween(checkIn, checkOut) : null;
  const updateCheckIn = (value: string) => {
    setCheckIn(value);
    // Keep the range valid: push check-out forward when check-in passes it.
    if (value && (!checkOut || checkOut <= value)) setCheckOut(addDaysLocal(value, 1));
  };
  const search = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = new URLSearchParams({ checkIn, checkOut, guests: String(guestCount) });
    startTransition(() => router.push(`/calendar/availability?${query}`));
  };

  return (
    <div className="min-w-0 space-y-8">
      <section aria-label="Search stays" className="rounded-2xl border border-pine/10 bg-white p-4 shadow-[0_1px_2px_rgba(32,58,53,0.06)] sm:p-5">
        <form method="get" action="/calendar/availability" onSubmit={search} className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,14rem)_auto] xl:items-end">
          <div className="min-w-0">
            <Label htmlFor="check-in">Check-in</Label>
            <DateField id="check-in" name="checkIn" value={checkIn} min={today} onChange={updateCheckIn} />
          </div>
          <div className="min-w-0">
            <Label htmlFor="check-out">Check-out</Label>
            <DateField id="check-out" name="checkOut" value={checkOut} min={checkIn ? addDaysLocal(checkIn, 1) : addDaysLocal(today, 1)} onChange={setCheckOut} />
          </div>
          <div className="min-w-0">
            <Label htmlFor="guest-count">Guests</Label>
            <div className="flex h-12 items-center rounded-xl border border-pine/20 bg-white focus-within:border-pine focus-within:ring-2 focus-within:ring-sage">
              <button type="button" aria-label="Fewer guests" onClick={() => setGuestCount((count) => Math.max(1, count - 1))} disabled={guestCount <= 1} className="flex h-full w-11 shrink-0 items-center justify-center rounded-l-xl text-pine hover:bg-pine-mist/60 disabled:opacity-35"><Minus className="h-4 w-4" aria-hidden /></button>
              <div className="flex min-w-0 flex-1 items-center justify-center gap-1.5">
                <Users className="h-4 w-4 shrink-0 text-pine/50" aria-hidden />
                <input id="guest-count" name="guests" type="number" inputMode="numeric" min={1} max={50} value={guestCount} onChange={(event) => setGuestCount(Math.min(50, Math.max(1, Number(event.target.value) || 1)))} required className="w-8 appearance-none bg-transparent text-center text-sm font-medium text-ink focus:outline-none [&::-webkit-inner-spin-button]:appearance-none" />
              </div>
              <button type="button" aria-label="More guests" onClick={() => setGuestCount((count) => Math.min(50, count + 1))} disabled={guestCount >= 50} className="flex h-full w-11 shrink-0 items-center justify-center rounded-r-xl text-pine hover:bg-pine-mist/60 disabled:opacity-35"><Plus className="h-4 w-4" aria-hidden /></button>
            </div>
          </div>
          <Button type="submit" variant="clay" disabled={pending} className="h-12 rounded-xl px-6 md:col-span-2 xl:col-span-1">
            <Search className="h-4 w-4" aria-hidden />
            {pending ? "Searching…" : "Search stays"}
          </Button>
        </form>
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-pine/10 pt-4">
          <span className="mr-1 text-xs font-medium uppercase tracking-wide text-ink/45">Quick picks</span>
          {presets(today).map((preset) => {
            const selected = preset.checkIn === checkIn && preset.checkOut === checkOut;
            return (
              <button key={preset.label} type="button" onClick={() => { setCheckIn(preset.checkIn); setCheckOut(preset.checkOut); }} aria-pressed={selected} className={cn("rounded-full border px-3 py-1 text-sm transition-colors", selected ? "border-pine bg-pine text-white" : "border-pine/15 text-pine hover:border-pine/40 hover:bg-pine-mist/60")}>
                {preset.label}
              </button>
            );
          })}
          {nights ? <span className="ml-auto text-sm text-ink/60">{dayLabel(checkIn)} → {dayLabel(checkOut)} · <span className="font-medium text-pine">{nights} night{nights === 1 ? "" : "s"}</span></span> : null}
        </div>
        <FieldError message={error} />
      </section>

      {pending ? <ResultsSkeleton /> : children}
    </div>
  );
}

function DateField({ id, name, value, min, onChange }: { id: string; name: string; value: string; min: string; onChange: (value: string) => void }) {
  return <DateInput id={id} name={name} value={value} min={min} onChange={onChange} required size="lg" />;
}

function ResultsSkeleton() {
  return (
    <div aria-hidden className="min-w-0">
      <div className="mb-5 h-8 w-56 animate-pulse rounded-lg bg-pine-mist" />
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="flex h-40 overflow-hidden rounded-2xl border border-pine/10 bg-white">
            <div className="w-2/5 shrink-0 animate-pulse bg-sage/30" />
            <div className="flex-1 space-y-3 p-4">
              <div className="h-3 w-24 animate-pulse rounded bg-pine-mist" />
              <div className="h-5 w-36 animate-pulse rounded bg-pine-mist" />
              <div className="h-4 w-28 animate-pulse rounded bg-pine-mist/70" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
