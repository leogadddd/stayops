import type { PaymentMethod } from "@/lib/db/schema";
import { PAYMENT_METHOD_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";

/** Logo tiles in `public/payment-methods` (see CREDITS.txt there). */
export const PAYMENT_METHOD_LOGOS: Record<PaymentMethod, string> = {
  gcash: "/payment-methods/gcash.svg",
  maya: "/payment-methods/maya.svg",
  bank_transfer: "/payment-methods/bank-transfer.svg",
  cash: "/payment-methods/cash.svg",
};

export function PaymentMethodLogo({ method, className }: { method: PaymentMethod; className?: string }) {
  return <img src={PAYMENT_METHOD_LOGOS[method]} alt="" aria-hidden className={cn("h-5 w-5 shrink-0 rounded-md", className)} />;
}

/** "[logo] GCash", for tables and history. */
export function PaymentMethodLabel({ method, className }: { method: PaymentMethod; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap", className)}>
      <PaymentMethodLogo method={method} className="h-4 w-4 rounded" />
      {PAYMENT_METHOD_LABELS[method]}
    </span>
  );
}
