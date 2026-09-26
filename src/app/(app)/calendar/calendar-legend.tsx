import type { CSSProperties } from "react";
import { BrushCleaning } from "lucide-react";
import type { DisplayCalendarEvent } from "./month-calendar";

export const HATCH: CSSProperties = {
  backgroundImage: "repeating-linear-gradient(135deg, #d9dbd7 0 5px, #c6c9c4 5px 10px)",
};

// Past stays stay calm but legible; upcoming stays carry the most colour
// after in-house.
const TONES = {
  confirmed: "border border-[#8fb09b] bg-[#b5cfbd] text-pine-deep",
  inHouse: "border border-pine bg-pine text-paper",
  checkedOut: "border border-[#b3c4bb] bg-[#d7e1dc] text-pine-soft",
  hold: "border border-dashed border-[#b0823f] bg-[#f1ddb9] text-[#553a1b]",
  blocked: "border border-[#a9ada8] text-[#323835]",
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

