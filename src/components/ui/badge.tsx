import { cn } from "@/lib/utils";

const tones = {
  sage: "bg-sage/70 text-pine-deep",
  clay: "bg-clay-mist text-clay-deep",
  neutral: "bg-pine-mist text-pine",
} as const;

export function Badge({
  tone = "neutral",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof tones }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
