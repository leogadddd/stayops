import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block h-10 w-8 shrink-0 bg-current", className)}
      style={{ mask: "url('/brand/stayops-mark.png') center / contain no-repeat" }}
    />
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label="StayOps"
      className={cn("inline-block h-11 w-44 shrink-0 bg-current text-pine", className)}
      style={{ mask: "url('/brand/stayops-logo.png') center / contain no-repeat" }}
    />
  );
}
