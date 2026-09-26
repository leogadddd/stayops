import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, type LucideIcon } from "lucide-react";
import type { UnitStatus } from "@/lib/db/schema";
import { RESERVATION_STATUS_LABELS, UNIT_STATUS_LABELS } from "@/lib/labels";
import { nightsBetween } from "@/lib/dates";
import type { StaySegment } from "@/lib/unit-activity";
import { buttonClassName } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { dayLabel } from "../calendar/availability/stay-display";

const STATUS_STYLES: Record<UnitStatus, { badge: string; dot: string }> = {
  active: { badge: "bg-sage/70 text-pine-deep", dot: "bg-moss" },
  ready_to_list: { badge: "bg-pine-mist text-pine", dot: "bg-pine/60" },
  renovating: { badge: "bg-sand text-bark", dot: "bg-sand-deep" },
  furnishing: { badge: "bg-sand text-bark", dot: "bg-sand-deep" },
  maintenance: { badge: "bg-clay-mist text-clay-deep", dot: "bg-clay" },
  inactive: { badge: "bg-ink/[0.06] text-ink/60", dot: "bg-ink/30" },
};

export function UnitStatusBadge({ status, className }: { status: UnitStatus; className?: string }) {
  const style = STATUS_STYLES[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        style.badge,
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", style.dot)} aria-hidden />
      {UNIT_STATUS_LABELS[status]}
    </span>
  );
}

/** A white rounded panel, the building block of the reservation-style pages. */
export function Panel({
  title,
  description,
  action,
  children,
  className,
  flush = false,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Let tables and lists run edge to edge. */
  flush?: boolean;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border border-pine/10 bg-white shadow-[0_1px_2px_rgba(32,58,53,0.06)]",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 sm:px-6">
        <div className="min-w-0">
          <h2 className="font-display text-lg text-pine">{title}</h2>
          {description ? <p className="mt-0.5 text-xs text-ink/55">{description}</p> : null}
        </div>
        {action}
      </div>
      <div className={flush ? "mt-4" : "px-5 pb-5 pt-4 sm:px-6"}>{children}</div>
    </section>
  );
}

export function StatTile({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail?: string;
  tone?: "clay" | "sage";
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-2.5 rounded-xl border p-3 sm:gap-3 sm:p-4",
        tone === "clay"
          ? "border-clay/25 bg-clay-mist/50"
          : tone === "sage"
            ? "border-sage-deep/30 bg-sage/35"
            : "border-transparent bg-linen",
      )}
    >
      <span
        className={cn(
          "hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl sm:flex",
          tone === "clay" ? "bg-clay text-white" : tone === "sage" ? "bg-pine text-white" : "bg-sage/60 text-pine",
        )}
      >
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <div className="min-w-0">
        <dt className="text-xs font-medium uppercase tracking-wide text-ink/45">{label}</dt>
        <dd className="mt-0.5 truncate font-display text-lg text-pine">{value}</dd>
        {detail ? <dd className="truncate text-xs text-ink/55">{detail}</dd> : null}
      </div>
    </div>
  );
}

/** A full-width row in the side "Manage" panel. */
export function SideAction({
  href,
  icon: Icon,
  children,
  tone = "outline",
}: {
  href: string;
  icon: LucideIcon;
  children: ReactNode;
  tone?: "outline" | "clay";
}) {
  return (
    <Link href={href} className={buttonClassName(tone, "md", "w-full justify-between")}>
      {children}
      <Icon className="h-4 w-4" aria-hidden />
    </Link>
  );
}

const STAY_DOT: Record<StaySegment["status"], string> = {
  hold: "bg-[#b0823f]",
  confirmed: "bg-[#8fb09b]",
  checked_in: "bg-pine",
  checked_out: "bg-[#b3c4bb]",
};

/** One stay in a list: dates, guest and status, linking to the reservation. */
export function StayRow({ stay, today, suffix }: { stay: StaySegment; today: string; suffix?: string }) {
  const nights = nightsBetween(stay.startDate, stay.endDate);
  const now = stay.startDate <= today;
  return (
    <Link
      href={`/reservations/${stay.id}`}
      className="group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-pine-mist/40 sm:px-6"
    >
      <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", STAY_DOT[stay.status])} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-pine">
          {stay.guestName}
          {suffix ? <span className="font-normal text-ink/50"> · {suffix}</span> : null}
        </span>
        <span className="block truncate text-xs text-ink/55">
          {dayLabel(stay.startDate)} → {dayLabel(stay.endDate)} · {nights} night{nights === 1 ? "" : "s"}
        </span>
      </span>
      <span
        className={cn(
          "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
          now ? "bg-pine text-white" : "bg-pine-mist text-pine",
        )}
      >
        {now ? "Staying now" : RESERVATION_STATUS_LABELS[stay.status]}
      </span>
      <ArrowRight
        className="h-4 w-4 shrink-0 text-ink/25 transition group-hover:translate-x-0.5 group-hover:text-clay"
        aria-hidden
      />
    </Link>
  );
}

/** "In house: Ana Cruz" / "Next: Ben, Oct 12" / "Free", for compact unit rows. */
export function activityLine(
  current: StaySegment | null,
  next: StaySegment | null,
): { label: string; tone: "pine" | "muted" } {
  if (current) return { label: `${current.status === "hold" ? "Held for" : "Staying:"} ${current.guestName}`, tone: "pine" };
  if (next) return { label: `Next: ${next.guestName}, ${dayLabel(next.startDate)}`, tone: "muted" };
  return { label: "No upcoming stays", tone: "muted" };
}

export function percent(numerator: number, denominator: number) {
  return denominator ? `${Math.round((numerator / denominator) * 100)}%` : "—";
}
