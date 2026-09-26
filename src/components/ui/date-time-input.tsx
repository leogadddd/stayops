"use client";

import { useId, useState, useSyncExternalStore } from "react";
import { Clock, TriangleAlert } from "lucide-react";
import { DateInput } from "@/components/ui/date-input";
import { TimeInput } from "@/components/ui/time-input";
import { cn } from "@/lib/utils";

/** Local date ("YYYY-MM-DD") and time ("HH:mm") of an instant in a time zone. */
function localParts(epochMs: number, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date(epochMs))
      .map((part) => [part.type, part.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

function shiftDate(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

const DAY_LABEL = new Intl.DateTimeFormat("en-PH", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
function readable(date: string, time: string) {
  const [hour, minute] = time.split(":").map(Number);
  return `${DAY_LABEL.format(new Date(`${date}T00:00:00Z`))} · ${hour! % 12 || 12}:${String(minute).padStart(2, "0")} ${hour! < 12 ? "AM" : "PM"}`;
}

// The current minute, as an external store so server and client renders agree.
function subscribeMinute(callback: () => void) {
  const timer = setInterval(callback, 15_000);
  return () => clearInterval(timer);
}
const currentMinute = () => Math.floor(Date.now() / 60_000) * 60_000;
const noMinute = () => null;

/**
 * A "when did this happen" field. "Right now" is the default and submits an
 * empty value (the server stamps the time). Unticking it reveals separate,
 * date and time pickers in the given time zone; the form receives one
 * `YYYY-MM-DDTHH:mm` value under `name`.
 */
export function DateTimeInput({ name, label, timeZone, nowLabel = "Right now", hint, allowFuture = false, className }: {
  name: string;
  label: string;
  timeZone: string;
  nowLabel?: string;
  hint?: string;
  allowFuture?: boolean;
  className?: string;
}) {
  const id = useId();
  const minute = useSyncExternalStore(subscribeMinute, currentMinute, noMinute);
  const [useNow, setUseNow] = useState(true);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");

  const now = minute === null ? null : localParts(minute, timeZone);
  const value = useNow || !date || !time ? "" : `${date}T${time}`;
  const future = Boolean(!allowFuture && now && value && value > `${now.date}T${now.time}`);
  const zoneLabel = timeZone.replace(/_/g, " ");

  function pickCustom() {
    setUseNow(false);
    // Start from the current moment so only the part that differs needs changing.
    if (!date || !time) {
      const start = localParts(Date.now(), timeZone);
      setDate(start.date);
      setTime(start.time);
    }
  }

  return (
    <fieldset className={cn("min-w-0", className)} aria-describedby={`${id}-summary`}>
      <legend className="mb-1.5 text-sm font-medium text-ink">{label}</legend>
      <input type="hidden" name={name} value={value} />

      <label htmlFor={`${id}-now`} className={cn("flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-colors", useNow ? "border-pine bg-pine-mist/60" : "border-pine/15 hover:border-pine/35")}>
        <input
          id={`${id}-now`}
          type="checkbox"
          checked={useNow}
          onChange={(event) => (event.target.checked ? setUseNow(true) : pickCustom())}
          className="h-4 w-4 shrink-0 accent-pine"
        />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-pine">{nowLabel}</span>
          <span className="block text-xs text-ink/55">{now ? `${readable(now.date, now.time)} · ${zoneLabel}` : zoneLabel}</span>
        </span>
        <Clock className="h-4 w-4 shrink-0 text-pine/45" aria-hidden />
      </label>

      {!useNow ? (
        <div className="mt-3 space-y-3 rounded-xl border border-pine/15 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="min-w-0">
              <label htmlFor={`${id}-date`} className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-ink/50">Date</label>
              <DateInput id={`${id}-date`} value={date} today={now?.date} max={allowFuture ? undefined : now?.date} onChange={setDate} />
            </div>
            <div className="min-w-0">
              <label htmlFor={`${id}-time`} className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-ink/50">Time</label>
              <TimeInput id={`${id}-time`} value={time} onChange={setTime} />
            </div>
          </div>
          {now ? (
            <div className="flex flex-wrap gap-2" role="group" aria-label="Quick dates">
              {[{ label: "Today", value: now.date }, { label: "Yesterday", value: shiftDate(now.date, -1) }, { label: "2 days ago", value: shiftDate(now.date, -2) }].map((option) => (
                <button key={option.label} type="button" onClick={() => setDate(option.value)} aria-pressed={date === option.value} className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors", date === option.value ? "border-pine bg-pine text-white" : "border-pine/15 text-pine hover:border-pine/35")}>
                  {option.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <p id={`${id}-summary`} className={cn("mt-2 flex items-center gap-1.5 text-xs", future ? "text-amber-800" : "text-ink/50")} aria-live="polite">
        {future ? <TriangleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden /> : null}
        {useNow
          ? hint ?? "Saved with the time you submit."
          : value
            ? `${future ? "That’s in the future: " : "Saved as "}${readable(date, time)} (${zoneLabel}).`
            : "Pick a date and time."}
      </p>
    </fieldset>
  );
}
