import { cn } from "@/lib/utils";

/**
 * StayOps logo mark — two overlapping open-door outlines, drawn after the
 * brand sheet. Uses currentColor so it adapts to light/dark surfaces.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      stroke="currentColor"
      strokeWidth={9}
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-hidden="true"
      className={cn("h-8 w-8", className)}
    >
      {/* Front door */}
      <path d="M18 96V32c0-4 2.5-7.5 6.5-9L56 12v96L26 101c-4.5 1-8-1.5-8-5Z" />
      {/* Back door */}
      <path d="M66 104V40c0-4 2-7 5.5-8.5L100 20v72l-24 11c-5 2-10-1-10 1Z" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="text-[1.35rem] font-semibold tracking-tight">
        StayOps
      </span>
    </span>
  );
}
