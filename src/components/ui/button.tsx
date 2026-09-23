import { cn } from "@/lib/utils";

const variants = {
  primary: "bg-pine text-white hover:bg-pine-soft",
  clay: "bg-clay text-white hover:bg-clay-deep",
  outline:
    "border border-pine/25 bg-transparent text-pine hover:border-pine/50 hover:bg-pine-mist/60",
  ghost: "text-pine hover:bg-pine-mist/70",
} as const;

const sizes = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-5 text-base",
} as const;

export function buttonClassName(
  variant: keyof typeof variants = "primary",
  size: keyof typeof sizes = "md",
  className?: string,
) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors",
    "disabled:pointer-events-none disabled:opacity-50",
    variants[variant],
    sizes[size],
    className,
  );
}

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
}) {
  return (
    <button className={buttonClassName(variant, size, className)} {...props} />
  );
}
