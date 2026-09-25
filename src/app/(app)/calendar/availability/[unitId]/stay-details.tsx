import { Ban, CalendarClock, Check, Clock, Globe, MapPin, Sparkles, Wallet } from "lucide-react";
import { formatPHP } from "@/lib/money";
import type { NightStatus, OccupancySegment } from "@/server/inventory/availability";
import { amenityIcon } from "../../../properties/amenity-icons";
import { timeLabel } from "../stay-display";
import type { PlannerDay, PlannerNeighbor } from "./stay-planner";

function durationLabel(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return [hours ? `${hours}h` : "", rest ? `${rest}m` : ""].filter(Boolean).join(" ");
}

/** Where a click on an occupied night or neighbour goes: the reservation, or (for owners) the unit's blocks. */
type SegmentHref = (segment: { kind: "reservation" | "block"; id: string }) => string | undefined;

/** The last stay or block ending on/before check-in, and the first starting on/after check-out. */
export function findNeighbors(segments: readonly OccupancySegment[], checkIn: string, checkOut: string, href: SegmentHref): { previous: PlannerNeighbor | null; next: PlannerNeighbor | null } {
  const occupying = segments.filter((segment) => segment.kind !== "turnover");
  const describe = (segment: (typeof occupying)[number], date: string): PlannerNeighbor => ({
    date,
    label: segment.kind === "block" ? `Blocked: ${segment.reason}` : `${segment.status === "hold" ? "Hold" : "Stay"} · ${segment.guestName}`,
    href: href(segment),
  });
  const previous = occupying.filter((segment) => segment.endDate <= checkIn).sort((a, b) => b.endDate.localeCompare(a.endDate))[0];
  const next = occupying.filter((segment) => segment.startDate >= checkOut).sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
  return {
    previous: previous ? describe(previous, previous.endDate) : null,
    next: next ? describe(next, next.startDate) : null,
  };
}

/** Night statuses flattened for the client date picker. */
export function plannerDays(nightStatus: Map<string, NightStatus>, href: SegmentHref): PlannerDay[] {
  return [...nightStatus].map(([date, status]) => {
    switch (status.kind) {
      case "booked": return { date, kind: "booked", label: `Booked · ${status.guestName}`, href: href({ kind: "reservation", id: status.segmentId }) };
      case "held": return { date, kind: "held", label: `Hold · ${status.guestName}`, href: href({ kind: "reservation", id: status.segmentId }) };
      case "blocked": return { date, kind: "blocked", label: `Blocked · ${status.reason}`, href: href({ kind: "block", id: status.segmentId }) };
      default: return { date, kind: "available", label: "Free" };
    }
  });
}

export function AmenityPanel({ groups }: { groups: { title: string; amenities: { id: string; name: string; icon: string | null }[] }[] }) {
  const listed = groups.filter((group) => group.amenities.length);
  if (!listed.length) return <p className="flex items-center gap-2 text-sm text-ink/55"><Sparkles className="h-4 w-4" aria-hidden />No amenities listed yet. Add them in the unit and property settings.</p>;
  return (
    <div className="space-y-5">
      {listed.map((group) => (
        <div key={group.title}>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-ink/45">{group.title}</h3>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 2xl:grid-cols-4">
            {group.amenities.map((amenity) => {
              const Icon = amenityIcon(amenity.icon);
              return (
                <li key={amenity.id} className="flex min-w-0 items-center gap-2.5 rounded-xl bg-linen px-3 py-2.5 text-sm text-pine">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sage/60 text-pine"><Icon className="h-4 w-4" aria-hidden /></span>
                  <span className="min-w-0 truncate">{amenity.name}</span>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function DetailsPanel({ checkInTime, checkOutTime, turnoverMinutes, timezone, address, rates }: {
  checkInTime: string;
  checkOutTime: string;
  turnoverMinutes: number;
  timezone: string;
  address: string | null;
  rates: { nightlyRateCents: number; cleaningFeeCents: number | null; securityDepositCents: number | null } | null;
}) {
  const items: { icon: typeof Clock; label: string; value: string }[] = [
    { icon: Clock, label: "Check-in", value: `From ${timeLabel(checkInTime)}` },
    { icon: Clock, label: "Check-out", value: `By ${timeLabel(checkOutTime)}` },
    { icon: CalendarClock, label: "Turnover", value: `${durationLabel(turnoverMinutes)} after each checkout` },
    { icon: Globe, label: "Time zone", value: timezone.replace(/_/g, " ") },
    ...(rates ? [
      { icon: Wallet, label: "Nightly rate", value: rates.nightlyRateCents ? formatPHP(rates.nightlyRateCents) : "Not set" },
      { icon: Sparkles, label: "Cleaning fee", value: rates.cleaningFeeCents ? formatPHP(rates.cleaningFeeCents) : "None" },
      { icon: Wallet, label: "Security deposit", value: rates.securityDepositCents ? `${formatPHP(rates.securityDepositCents)}, refundable` : "None" },
    ] : []),
    ...(address ? [{ icon: MapPin, label: "Address", value: address }] : []),
  ];
  return (
    <dl className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {items.map(({ icon: Icon, label, value }) => (
        <div key={label} className="flex min-w-0 gap-3 rounded-xl bg-linen p-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sage/60 text-pine"><Icon className="h-4 w-4" aria-hidden /></span>
          <div className="min-w-0">
            <dt className="text-xs font-medium uppercase tracking-wide text-ink/45">{label}</dt>
            <dd className="mt-0.5 text-sm text-pine">{value}</dd>
          </div>
        </div>
      ))}
    </dl>
  );
}

export function houseRuleLines(rules: string | null) {
  return (rules ?? "").split(/\r?\n/).map((line) => line.replace(/^\s*[-*•]\s*/, "").trim()).filter(Boolean);
}

export function RulesPanel({ lines }: { lines: string[] }) {
  if (!lines.length) return <p className="flex items-center gap-2 text-sm text-ink/55"><Ban className="h-4 w-4" aria-hidden />No house rules set for this property.</p>;
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {lines.map((line, index) => (
        <li key={index} className="flex gap-2.5 rounded-xl bg-linen p-3 text-sm text-ink/80">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-pine/60" aria-hidden />{line}
        </li>
      ))}
    </ul>
  );
}
