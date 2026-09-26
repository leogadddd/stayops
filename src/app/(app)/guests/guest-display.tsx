import type { GuestActivity } from "@/server/reservations/service";
import { cn } from "@/lib/utils";

export const GUEST_ACTIVITY_LABELS: Record<GuestActivity, string> = {
  in_house: "Staying now",
  upcoming: "Upcoming",
  past: "Past guest",
  no_stays: "No stays",
};

export const GUEST_ACTIVITY_STYLES: Record<GuestActivity, { badge: string; dot: string }> = {
  in_house: { badge: "bg-sage/70 text-pine-deep", dot: "bg-primary" },
  upcoming: { badge: "bg-pine-mist text-pine", dot: "bg-stay-booked-line" },
  past: { badge: "bg-sand text-bark", dot: "bg-stay-departed-line" },
  no_stays: { badge: "bg-ink/[0.06] text-ink/60", dot: "bg-ink/30" },
};

export function GuestActivityBadge({ activity, className }: { activity: GuestActivity; className?: string }) {
  const style = GUEST_ACTIVITY_STYLES[activity];
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium", style.badge, className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", style.dot)} aria-hidden />
      {GUEST_ACTIVITY_LABELS[activity]}
    </span>
  );
}

export function GuestAvatar({ name, size = "md" }: { name: string; size?: "md" | "lg" }) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-sage/60 font-medium text-pine",
        size === "lg" ? "h-12 w-12 text-base" : "h-8 w-8 text-xs",
      )}
    >
      {initials || "?"}
    </span>
  );
}

export function GuestTags({ tags, className }: { tags: readonly string[]; className?: string }) {
  if (!tags.length) return null;
  return (
    <ul className={cn("flex flex-wrap gap-1.5", className)} aria-label="Tags">
      {tags.map((tag) => (
        <li key={tag} className="rounded-full bg-linen px-2 py-0.5 text-xs text-pine">{tag}</li>
      ))}
    </ul>
  );
}
