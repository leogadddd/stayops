import { cn } from "@/lib/utils";

export function Input({
  className,
  ...props
}: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-lg border border-pine/20 bg-surface px-3 text-sm",
        "placeholder:text-ink/35",
        "focus:border-pine focus:outline-none focus:ring-2 focus:ring-sage",
        "disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
}

export function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("mb-1.5 block text-sm font-medium text-ink", className)}
      {...props}
    />
  );
}

const selectClassName =
  "h-10 w-full rounded-lg border border-pine/20 bg-surface px-3 text-sm " +
  "focus:border-pine focus:outline-none focus:ring-2 focus:ring-sage " +
  "disabled:cursor-not-allowed disabled:opacity-60";

export function Select({
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(selectClassName, className)} {...props} />;
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-24 w-full rounded-lg border border-pine/20 bg-surface px-3 py-2 text-sm",
        "placeholder:text-ink/35",
        "focus:border-pine focus:outline-none focus:ring-2 focus:ring-sage",
        "disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="mt-1.5 text-sm text-clay-deep" role="alert">
      {message}
    </p>
  );
}
