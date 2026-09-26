import { cn } from "@/lib/utils";

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-pine/25 bg-surface/60 px-6 py-16 text-center",
        className,
      )}
    >
      <h3 className="font-display text-xl text-pine">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-ink/60">
        {description}
      </p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
