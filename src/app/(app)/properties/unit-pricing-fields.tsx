"use client";

import { useState } from "react";
import { Input, Label } from "@/components/ui/input";
import { TimeInput } from "@/components/ui/time-input";
import { WEEKDAYS, type Weekday } from "@/lib/rates";
import { fromMinutes, stayLengthHours, toMinutes } from "@/lib/stay-times";
import { cn } from "@/lib/utils";
import { PesoInput } from "./form-kit";

const STAY_LENGTHS = [12, 18, 20, 22, 23, 24];

/**
 * Check-in, stay length and check-out, kept in step: changing the check-in
 * or the length fills in check-out; editing check-out updates the length.
 * Stays are overnight, so check-out lands on the next day.
 */
export function StayTimesFields({ defaultCheckIn, defaultCheckOut }: { defaultCheckIn: string; defaultCheckOut: string }) {
  const [checkIn, setCheckIn] = useState(defaultCheckIn);
  const [checkOut, setCheckOut] = useState(defaultCheckOut);
  const [hoursInput, setHoursInput] = useState(String(stayLengthHours(defaultCheckIn, defaultCheckOut) ?? ""));
  const hours = stayLengthHours(checkIn, checkOut);

  const applyLength = (value: string, from = checkIn) => {
    setHoursInput(value);
    const length = Number(value);
    const start = toMinutes(from);
    if (start !== null && length > 0 && length <= 24) setCheckOut(fromMinutes(start + length * 60));
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="unit-check-in">Check-in from</Label>
          <TimeInput
            id="unit-check-in"
            name="checkInTime"
            value={checkIn}
            onChange={(time) => {
              setCheckIn(time);
              applyLength(hoursInput, time);
            }}
            required
          />
        </div>
        <div>
          <Label htmlFor="unit-stay-length">Stay length</Label>
          <div className="relative">
            <Input
              id="unit-stay-length"
              type="number"
              min={1}
              max={24}
              step={0.5}
              value={hoursInput}
              onChange={(event) => applyLength(event.target.value)}
              className="pr-14"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink/45">hours</span>
          </div>
        </div>
        <div>
          <Label htmlFor="unit-check-out">Check-out by</Label>
          <TimeInput
            id="unit-check-out"
            name="checkOutTime"
            value={checkOut}
            onChange={(time) => {
              setCheckOut(time);
              const length = stayLengthHours(checkIn, time);
              if (length !== null) setHoursInput(String(length));
            }}
            required
          />
          <p className="mt-1.5 text-xs text-ink/50">The next day</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Common stay lengths">
        <span className="text-xs text-ink/50">Quick pick:</span>
        {STAY_LENGTHS.map((length) => (
          <button
            key={length}
            type="button"
            onClick={() => applyLength(String(length))}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              hours === length ? "border-pine bg-pine text-white" : "border-pine/15 text-pine hover:border-pine/35",
            )}
          >
            {length}h
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Optional nightly rates per weekday, e.g. a higher Friday and Saturday
 * rate. Blank days use the regular nightly rate. Inputs submit as
 * `dayRate-<weekday>` in pesos.
 */
export function DayRatesFields({
  defaults,
  regularRate,
}: {
  defaults: Partial<Record<Weekday, string>>;
  /** The regular nightly rate as typed, shown as each day's placeholder. */
  regularRate: string;
}) {
  const [open, setOpen] = useState(Object.values(defaults).some(Boolean));
  const [rates, setRates] = useState<Partial<Record<Weekday, string>>>(defaults);
  const [weekendInput, setWeekendInput] = useState("");

  return (
    <div className="rounded-xl border border-pine/10 bg-linen/50 p-4">
      <label className="flex cursor-pointer items-center justify-between gap-3">
        <span>
          <span className="block text-sm font-medium text-pine">Different rates on some days</span>
          <span className="block text-xs text-ink/55">Like a higher rate for Friday and Saturday nights.</span>
        </span>
        <input
          type="checkbox"
          checked={open}
          onChange={(event) => setOpen(event.target.checked)}
          className="h-5 w-5 shrink-0 accent-pine"
        />
      </label>
      {open ? (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
            {WEEKDAYS.map((day) => (
              <div key={day.key}>
                <Label htmlFor={`day-rate-${day.key}`} className={cn("text-xs", (day.key === "5" || day.key === "6") && "text-clay-deep")}>
                  {day.short}
                </Label>
                <PesoInput
                  id={`day-rate-${day.key}`}
                  name={`dayRate-${day.key}`}
                  aria-label={`${day.long} night rate`}
                  value={rates[day.key] ?? ""}
                  onChange={(event) => setRates((current) => ({ ...current, [day.key]: event.target.value }))}
                  placeholder={regularRate || "—"}
                />
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-ink/55">Weekend (Fri &amp; Sat nights):</span>
            <div className="w-32">
              <PesoInput
                aria-label="Weekend rate"
                value={weekendInput}
                onChange={(event) => setWeekendInput(event.target.value)}
                placeholder="7,000"
                className="h-8"
              />
            </div>
            <button
              type="button"
              onClick={() => setRates((current) => ({ ...current, "5": weekendInput, "6": weekendInput }))}
              disabled={!weekendInput.trim()}
              className="rounded-full border border-pine/15 px-3 py-1 text-xs font-medium text-pine hover:border-pine/35 disabled:opacity-40"
            >
              Set Fri &amp; Sat
            </button>
            <button
              type="button"
              onClick={() => setRates({})}
              className="text-xs text-ink/50 underline-offset-4 hover:text-clay-deep hover:underline"
            >
              Clear all
            </button>
          </div>
          <p className="text-xs text-ink/50">Blank days use the regular nightly rate. A night is priced by the day it starts.</p>
        </div>
      ) : null /* Off means no day inputs submit, so saving clears any day rates. */}
    </div>
  );
}
