import { House } from "lucide-react";
import { cn } from "@/lib/utils";

const DAY_LABEL = new Intl.DateTimeFormat("en-PH", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

export function dayLabel(date: string) {
  return DAY_LABEL.format(new Date(`${date}T00:00:00Z`));
}

export function timeLabel(time: string) {
  const [hour, minute] = time.split(":");
  return `${Number(hour) % 12 || 12}${minute === "00" ? "" : `:${minute}`} ${Number(hour) < 12 ? "AM" : "PM"}`;
}

export function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

/** A unit's cover photo, or a quiet placeholder when none was uploaded. */
export function UnitPhoto({ src, className, imageClassName }: { src: string | null; className?: string; imageClassName?: string }) {
  return (
    <div className={cn("relative overflow-hidden bg-sage/30", className)}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- owner-uploaded covers are self-contained URLs
        <img src={src} alt="" className={cn("absolute inset-0 h-full w-full object-cover", imageClassName)} />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-gradient-to-br from-sage/50 to-linen text-pine/45">
          <House className="h-8 w-8" aria-hidden />
          <span className="text-xs font-medium">No photo yet</span>
        </div>
      )}
    </div>
  );
}
