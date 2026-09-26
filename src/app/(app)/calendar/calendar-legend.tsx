import type { CSSProperties } from "react";
import { BrushCleaning } from "lucide-react";
import type { DisplayCalendarEvent } from "./month-calendar";

export const HATCH: CSSProperties = {
  backgroundImage: "repeating-linear-gradient(135deg, var(--color-stay-blocked) 0 5px, var(--color-stay-blocked-alt) 5px 10px)",
};

// Past stays stay calm but legible; upcoming stays carry the most colour
// after in-house.
const TONES = {
  confirmed: "border border-stay-booked-line bg-stay-booked text-pine-deep",
  inHouse: "border border-primary bg-primary text-white",
  checkedOut: "border border-stay-departed-line bg-stay-departed text-pine-soft",
  hold: "border border-dashed border-stay-hold-line bg-stay-hold text-stay-hold-ink",
  blocked: "border border-stay-blocked-line text-stay-blocked-ink",
};

/** Shared by every calendar view so a stay looks the same in each. */
export function barStyle(event: DisplayCalendarEvent): { className: string; style?: CSSProperties } {
  if (event.kind === "hold") return { className: TONES.hold };
  if (event.kind === "block" || event.kind === "unavailable") return { className: TONES.blocked, style: HATCH };
  if (event.status === "checked_in") return { className: TONES.inHouse };
  if (event.status === "checked_out") return { className: TONES.checkedOut };
  return { className: TONES.confirmed };
}

const LEGEND: { label: string; swatch: ReturnType<typeof barStyle> }[] = [
  { label: "Confirmed", swatch: { className: TONES.confirmed } },
  { label: "In-house", swatch: { className: TONES.inHouse } },
  { label: "Checked out", swatch: { className: TONES.checkedOut } },
  { label: "Hold", swatch: { className: TONES.hold } },
  { label: "Blocked", swatch: { className: TONES.blocked, style: HATCH } },
];

export function CalendarLegend() {
  return (
    <ul aria-label="Calendar legend" className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-ink/75">
      {LEGEND.map(({ label, swatch }) => (
        <li key={label} className="inline-flex items-center gap-2"><span aria-hidden className={`h-3 w-6 rounded-full ${swatch.className}`} style={swatch.style} />{label}</li>
      ))}
      <li className="inline-flex items-center gap-2">
        <span aria-hidden className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-clay/30 bg-clay-mist text-clay-deep"><BrushCleaning className="h-3 w-3" /></span>
        Turnover
      </li>
    </ul>
  );
}

