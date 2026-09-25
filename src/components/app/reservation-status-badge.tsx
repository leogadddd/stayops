import type { ReservationStatus } from "@/lib/db/schema";
import { RESERVATION_STATUS_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";

/** Solid, distinct colours so a status reads at a glance down a long list. */
export const RESERVATION_STATUS_STYLES: Record<ReservationStatus, { badge: string; dot: string }> = {
  hold: { badge: "bg-amber-100 text-amber-900 ring-amber-300", dot: "bg-amber-500" },
  confirmed: { badge: "bg-pine text-white ring-pine", dot: "bg-sage" },
  checked_in: { badge: "bg-sage text-pine-deep ring-sage-deep", dot: "bg-pine" },
  checked_out: { badge: "bg-pine-mist text-pine ring-pine/20", dot: "bg-pine/50" },
  cancelled: { badge: "bg-clay-mist text-clay-deep ring-clay/30", dot: "bg-clay" },
  expired: { badge: "bg-ink/[0.07] text-ink/60 ring-ink/15", dot: "bg-ink/35" },
};

export function ReservationStatusBadge({ status, className, title }: { status: ReservationStatus; className?: string; title?: string }) {
  const style = RESERVATION_STATUS_STYLES[status];
  return (
    <span title={title} className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset", style.badge, className)}>
      <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", style.dot)} />
      {RESERVATION_STATUS_LABELS[status]}
    </span>
  );
}
