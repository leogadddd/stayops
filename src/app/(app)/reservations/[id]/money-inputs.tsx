"use client";

import type { ReactNode } from "react";
import { Banknote, CircleCheck, Landmark, Smartphone, Wallet, type LucideIcon } from "lucide-react";
import { Input, Label } from "@/components/ui/input";
import { PAYMENT_METHOD_LABELS } from "@/lib/labels";
import { centavosToPesosInput, formatPHP, pesosToCentavos } from "@/lib/money";
import { cn } from "@/lib/utils";

/** Shared pieces of the payment, refund, and deduction forms. */

export const PAYMENT_METHODS = ["gcash", "maya", "bank_transfer", "cash"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export function parseAmount(input: string): number | null {
  if (!input.trim()) return null;
  try {
    return pesosToCentavos(input, { allowZero: false });
  } catch {
    return null;
  }
}

/** A radio styled as a card; the native input stays for keyboard and screen readers. */
export function ChoiceCard({ name, value, checked, onSelect, icon: Icon, title, disabled, compact, children }: {
  name: string;
  value: string;
  checked: boolean;
  onSelect: () => void;
  icon: LucideIcon;
  title: string;
  disabled?: boolean;
  compact?: boolean;
  children?: ReactNode;
}) {
  return (
    <label className={cn(
      "relative flex min-w-0 gap-3 rounded-xl border p-3 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-clay",
      compact ? "flex-col items-center text-center" : "items-start",
      disabled ? "cursor-not-allowed border-pine/10 bg-linen/60 opacity-60" : checked ? "cursor-pointer border-clay bg-clay-mist/40 ring-1 ring-clay" : "cursor-pointer border-pine/15 hover:border-pine/35",
    )}>
      <input type="radio" name={name} value={value} checked={checked} disabled={disabled} onChange={onSelect} className="sr-only" />
      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", checked ? "bg-clay text-white" : "bg-sage/60 text-pine")}><Icon className="h-4 w-4" aria-hidden /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-pine">{title}</span>
        {children ? <span className="mt-1 block">{children}</span> : null}
      </span>
      {checked && !compact ? <CircleCheck className="h-4 w-4 shrink-0 text-clay" aria-hidden /> : null}
    </label>
  );
}

/** One line of text over a thin bar, e.g. "₱12,000 left of ₱17,000". */
export function Progress({ label, share }: { label: string; share: number }) {
  return (
    <>
      <span className="block text-xs text-ink/60">{label}</span>
      <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-pine/10" aria-hidden><span className="block h-full rounded-full bg-pine" style={{ width: `${Math.min(1, Math.max(0, share)) * 100}%` }} /></span>
    </>
  );
}

const METHOD_ICONS: Record<PaymentMethod, LucideIcon> = { gcash: Smartphone, maya: Wallet, bank_transfer: Landmark, cash: Banknote };

/** GCash / Maya / Bank transfer / Cash as a row of cards, submitted as `method`. */
export function MethodPicker({ legend, value, onChange }: { legend: string; value: PaymentMethod; onChange: (method: PaymentMethod) => void }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-ink">{legend}</legend>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {PAYMENT_METHODS.map((option) => (
          <ChoiceCard key={option} name="method" value={option} checked={value === option} onSelect={() => onChange(option)} icon={METHOD_ICONS[option]} title={PAYMENT_METHOD_LABELS[option]} compact />
        ))}
      </div>
    </fieldset>
  );
}

/**
 * The big ₱ amount input with quick picks. `base` is what the percentages are
 * of; `picks` adds named amounts such as "Remaining". `details` sits below
 * and is announced as it changes.
 */
export function AmountField({ id, name, label, value, onChange, base, picks = [], invalid, details }: {
  id: string;
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  base: number;
  picks?: { label: string; cents: number }[];
  invalid: boolean;
  details: ReactNode;
}) {
  const cents = parseAmount(value);
  const shares = base > 0 ? [25, 50, 100].map((share) => ({ label: `${share}%`, cents: Math.round((base * share) / 100) })) : [];
  const options = [...shares, ...picks.filter((pick) => pick.cents > 0 && !shares.some((share) => share.cents === pick.cents))];
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className={cn("flex h-14 items-center rounded-xl border bg-white focus-within:ring-2 focus-within:ring-sage", invalid ? "border-clay" : "border-pine/20 focus-within:border-pine")}>
        <span className="pl-4 pr-1 font-display text-2xl text-pine/45" aria-hidden>₱</span>
        <Input
          id={id}
          name={name}
          inputMode="decimal"
          autoComplete="off"
          placeholder="0"
          required
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-describedby={`${id}-details`}
          aria-invalid={invalid || undefined}
          className="h-full border-0 bg-transparent px-1 font-display text-2xl text-pine focus:ring-0"
        />
      </div>
      {options.length ? (
        <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Quick amounts">
          {options.map((option) => {
            const active = cents === option.cents;
            return (
              <button key={option.label} type="button" onClick={() => onChange(centavosToPesosInput(option.cents))} aria-pressed={active} className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors", active ? "border-pine bg-pine text-white" : "border-pine/15 text-pine hover:border-pine/35")}>
                {option.label}<span className={active ? "text-white/70" : "text-ink/50"}>{formatPHP(option.cents)}</span>
              </button>
            );
          })}
        </div>
      ) : null}
      <p id={`${id}-details`} className="mt-2 text-xs" aria-live="polite">{details}</p>
    </div>
  );
}
