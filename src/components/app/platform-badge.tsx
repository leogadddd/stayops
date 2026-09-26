import { cn } from "@/lib/utils";

export interface PlatformDisplay {
  name: string;
  logoUrl: string | null;
  color: string | null;
}

/** A platform's logo, or a monogram in its color when it has none. */
export function PlatformLogo({ platform, className }: { platform: PlatformDisplay; className?: string }) {
  if (platform.logoUrl) {
    return <img src={platform.logoUrl} alt="" aria-hidden className={cn("h-5 w-5 shrink-0 rounded-md object-contain", className)} />;
  }
  return (
    <span aria-hidden className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-pine text-[10px] font-bold text-white", className)} style={platform.color ? { backgroundColor: platform.color } : undefined}>
      {platform.name.trim().slice(0, 1).toUpperCase()}
    </span>
  );
}

export function PlatformBadge({ platform, className }: { platform: PlatformDisplay | null; className?: string }) {
  if (!platform) return <span className={cn("text-ink/40", className)}>—</span>;
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1.5 whitespace-nowrap", className)}>
      <PlatformLogo platform={platform} className="h-4 w-4 rounded" />
      <span className="truncate">{platform.name}</span>
    </span>
  );
}
