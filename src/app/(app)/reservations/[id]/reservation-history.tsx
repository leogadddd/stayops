import type { ReactNode } from "react";
import { ArrowRight, FileUp, Flag, RotateCcw, ShieldMinus, Undo2, Wallet, type LucideIcon } from "lucide-react";
import type { ReservationStatus } from "@/lib/db/schema";
import { PAYMENT_ALLOCATION_LABELS, PAYMENT_METHOD_LABELS } from "@/lib/labels";
import { formatPHP } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { ReservationLedger } from "@/server/payments/service";
import { ReservationStatusBadge } from "@/components/app/reservation-status-badge";

interface Transition {
  id: string;
  fromStatus: ReservationStatus | null;
  toStatus: ReservationStatus;
  note: string | null;
  createdAt: Date;
}

interface HistoryEvent {
  key: string;
  at: Date;
  icon: LucideIcon;
  tone: "pine" | "sage" | "clay" | "neutral";
  title: ReactNode;
  detail?: string | null;
  /** When it was entered, if later than when it happened (e.g. a payment logged the next day). */
  recordedAt?: Date;
}

const TONES = {
  pine: "bg-pine text-white",
  sage: "bg-sage text-pine-deep",
  clay: "bg-clay-mist text-clay-deep",
  neutral: "bg-pine-mist text-pine",
};
const PROOF_LABELS = { unverified: "Awaiting review", recorded: "Recorded as payment", dismissed: "Dismissed" } as const;
// Payments logged more than this long after they arrived also show when they were entered.
const LATE_ENTRY_MS = 30 * 60_000;

function join(...parts: (string | null | undefined)[]) {
  return parts.filter(Boolean).join(" · ");
}

/**
 * Status changes, and for owners every money movement, in the order they
 * happened. Staff pass no ledger and see status changes only.
 */
export function ReservationHistory({ transitions, ledger, timeZone }: {
  transitions: Transition[];
  ledger: Pick<ReservationLedger, "payments" | "refunds" | "deductions" | "proofs"> | null;
  timeZone: string;
}) {
  const time = new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone });
  const events: HistoryEvent[] = transitions.map((transition) => ({
    key: `status-${transition.id}`,
    at: transition.createdAt,
    icon: Flag,
    tone: "pine",
    title: (
      <span className="flex flex-wrap items-center gap-2">
        {transition.fromStatus
          ? <><ReservationStatusBadge status={transition.fromStatus} /><ArrowRight className="h-3.5 w-3.5 text-ink/35" aria-hidden /></>
          : <span className="text-sm text-ink/60">Created as</span>}
        <ReservationStatusBadge status={transition.toStatus} />
      </span>
    ),
    detail: transition.note,
  }));

  if (ledger) {
    for (const payment of ledger.payments) {
      const reversal = Boolean(payment.reversalOfId);
      events.push({
        key: `payment-${payment.id}`,
        at: payment.receivedAt,
        icon: reversal ? Undo2 : Wallet,
        tone: reversal ? "clay" : "sage",
        title: <span className="text-sm font-medium text-pine">{reversal ? "Payment reversed" : "Payment received"} · <span className="tabular-nums">{formatPHP(payment.amountCents)}</span></span>,
        detail: join(PAYMENT_METHOD_LABELS[payment.method], `towards ${PAYMENT_ALLOCATION_LABELS[payment.allocation].toLowerCase()}`, payment.reference ? `ref ${payment.reference}` : null),
        recordedAt: payment.createdAt.getTime() - payment.receivedAt.getTime() > LATE_ENTRY_MS ? payment.createdAt : undefined,
      });
    }
    for (const refund of ledger.refunds) {
      events.push({
        key: `refund-${refund.id}`,
        at: refund.refundedAt,
        icon: RotateCcw,
        tone: "clay",
        title: <span className="text-sm font-medium text-pine">Refund · <span className="tabular-nums">{formatPHP(refund.amountCents)}</span></span>,
        detail: join(`Returned via ${PAYMENT_METHOD_LABELS[refund.method]}`, `from ${PAYMENT_ALLOCATION_LABELS[refund.allocation].toLowerCase()}`, refund.reason),
      });
    }
    for (const deduction of ledger.deductions) {
      events.push({
        key: `deduction-${deduction.id}`,
        at: deduction.createdAt,
        icon: ShieldMinus,
        tone: "clay",
        title: <span className="text-sm font-medium text-pine">Kept from deposit · <span className="tabular-nums">{formatPHP(deduction.amountCents)}</span></span>,
        detail: deduction.reason,
      });
    }
    for (const proof of ledger.proofs) {
      events.push({
        key: `proof-${proof.id}`,
        at: proof.createdAt,
        icon: FileUp,
        tone: "neutral",
        title: <span className="text-sm font-medium text-pine">Guest sent payment proof · <span className="font-normal text-ink/60">{PROOF_LABELS[proof.status]}</span></span>,
        detail: join(proof.reference ? `ref ${proof.reference}` : null, proof.note),
      });
    }
  }
  events.sort((a, b) => a.at.getTime() - b.at.getTime());

  return (
    <ol className="mt-4 space-y-5">
      {events.map((event, index) => {
        const Icon = event.icon;
        return (
          <li key={event.key} className="relative flex gap-3">
            {index < events.length - 1 ? <span aria-hidden className="absolute left-3.5 top-8 h-[calc(100%-0.5rem)] w-0.5 bg-sage" /> : null}
            <span className={cn("relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ring-4 ring-white", TONES[event.tone])}><Icon className="h-3.5 w-3.5" aria-hidden /></span>
            <div className="min-w-0 flex-1 pt-0.5">
              {event.title}
              {event.detail ? <p className="mt-1 break-words text-sm text-ink/60">{event.detail}</p> : null}
              <p className="mt-1 text-xs text-ink/45">
                <time dateTime={event.at.toISOString()}>{time.format(event.at)}</time>
                {event.recordedAt ? <> · recorded {time.format(event.recordedAt)}</> : null}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
