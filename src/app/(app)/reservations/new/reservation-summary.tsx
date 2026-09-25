import { Bath, BedDouble, CalendarDays, Users } from "lucide-react";
import type { ChargeLineValues } from "@/lib/charges";
import { formatPHP } from "@/lib/money";
import { cn } from "@/lib/utils";
import { dayLabel, timeLabel, UnitPhoto } from "../../calendar/availability/stay-display";
import type { UnitOption } from "./reservation-form";

/** The sticky side card: which unit, when, who, and (for owners) what it costs. */
export function ReservationSummary({ unit, checkIn, checkOut, nights, guestCount, guestName, lines, totals, paymentCents, paymentAllocation, alreadyPaid, isOwner }: {
  unit: UnitOption | undefined;
  checkIn: string;
  checkOut: string;
  nights: number | null;
  guestCount: number;
  guestName: string | null;
  lines: ChargeLineValues[];
  totals: { bookingTotalCents: number; depositTotalCents: number };
  paymentCents: number | null;
  paymentAllocation: "booking" | "security_deposit";
  /** Editing: what the ledger already holds for this reservation. */
  alreadyPaid?: { bookingCents: number; depositCents: number };
  isOwner: boolean;
}) {
  const paidBooking = (alreadyPaid?.bookingCents ?? 0) + (paymentCents && paymentAllocation === "booking" ? paymentCents : 0);
  const paidDeposit = (alreadyPaid?.depositCents ?? 0) + (paymentCents && paymentAllocation === "security_deposit" ? paymentCents : 0);
  const paidTotal = paidBooking + paidDeposit;
  return (
    <div className="overflow-hidden rounded-2xl border border-pine/10 bg-white shadow-[0_1px_2px_rgba(32,58,53,0.06)]">
      <UnitPhoto src={unit?.imageUrl ?? null} className="aspect-[16/9] w-full" />
      <div className="space-y-4 p-5">
        <div>
          {unit?.propertyName ? <p className="truncate text-xs font-medium uppercase tracking-wide text-clay-deep">{unit.propertyName}</p> : null}
          <h2 className="mt-0.5 truncate font-display text-xl text-pine">{unit?.name ?? "Choose a unit"}</h2>
          {unit ? (
            <ul className="mt-2 flex flex-wrap gap-x-3.5 gap-y-1 text-sm text-ink/65">
              <li className="flex items-center gap-1" title={`Sleeps ${unit.capacity}`}><Users className="h-4 w-4 text-pine/50" aria-hidden />{unit.capacity}</li>
              <li className="flex items-center gap-1"><BedDouble className="h-4 w-4 text-pine/50" aria-hidden />{unit.bedrooms || "Studio"}</li>
              <li className="flex items-center gap-1"><Bath className="h-4 w-4 text-pine/50" aria-hidden />{unit.bathrooms}</li>
            </ul>
          ) : null}
        </div>

        <dl className="grid grid-cols-2 overflow-hidden rounded-xl border border-pine/15 text-sm">
          <SummaryCell label="Check-in" value={nights ? dayLabel(checkIn) : "—"} detail={unit && nights ? `From ${timeLabel(unit.checkInTime)}` : undefined} className="border-b border-r" />
          <SummaryCell label="Check-out" value={nights ? dayLabel(checkOut) : "—"} detail={unit && nights ? `By ${timeLabel(unit.checkOutTime)}` : undefined} className="border-b" />
          <SummaryCell label="Nights" value={nights ? String(nights) : "—"} className="border-r" />
          <SummaryCell label="Guests" value={String(guestCount)} detail={unit ? `of ${unit.capacity}` : undefined} />
        </dl>
        {guestName ? <p className="flex items-center gap-2 text-sm text-ink/70"><CalendarDays className="h-4 w-4 shrink-0 text-pine/50" aria-hidden />For <span className="truncate font-medium text-pine">{guestName}</span></p> : null}

        {isOwner ? (
          <div className="border-t border-pine/10 pt-4">
            <h3 className="text-xs font-medium uppercase tracking-wide text-ink/45">Payment breakdown</h3>
            {lines.length ? (
              <dl className="mt-3 space-y-2 text-sm">
                {lines.filter((line) => line.type !== "security_deposit").map((line, index) => (
                  <div key={index} className="flex justify-between gap-3 text-ink/70">
                    <dt className="min-w-0 truncate">{line.description}{line.quantity > 1 ? <span className="text-ink/45"> · {line.quantity} × {formatPHP(line.unitAmountCents)}</span> : null}</dt>
                    <dd className={cn("shrink-0", line.type === "discount" && "text-clay-deep")}>{formatPHP(line.quantity * line.unitAmountCents)}</dd>
                  </div>
                ))}
                <div className="flex justify-between gap-3 border-t border-pine/10 pt-2 font-medium text-pine"><dt>Booking total</dt><dd className="font-display text-lg">{formatPHP(totals.bookingTotalCents)}</dd></div>
                {totals.depositTotalCents ? <div className="flex justify-between gap-3 text-ink/70"><dt>Refundable deposit</dt><dd>{formatPHP(totals.depositTotalCents)}</dd></div> : null}
                {paidTotal ? (
                  <>
                    <div className="flex justify-between gap-3 text-ink/70"><dt>{alreadyPaid ? "Paid so far" : "Payment recorded"}</dt><dd>−{formatPHP(paidTotal)}</dd></div>
                    <div className="flex justify-between gap-3 rounded-lg bg-linen px-3 py-2 font-medium text-pine">
                      <dt>Still due</dt>
                      <dd>{formatPHP(Math.max(0, totals.bookingTotalCents - paidBooking) + Math.max(0, totals.depositTotalCents - paidDeposit))}</dd>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between gap-3 rounded-lg bg-linen px-3 py-2 font-medium text-pine"><dt>Due from guest</dt><dd>{formatPHP(totals.bookingTotalCents + totals.depositTotalCents)}</dd></div>
                )}
              </dl>
            ) : <p className="mt-2 text-sm text-ink/55">Charges appear once the unit and dates are set.</p>}
          </div>
        ) : <p className="border-t border-pine/10 pt-4 text-sm text-ink/60">Priced at the unit’s default rates. The owner reviews charges when confirming.</p>}
      </div>
    </div>
  );
}

function SummaryCell({ label, value, detail, className }: { label: string; value: string; detail?: string; className?: string }) {
  return (
    <div className={cn("border-pine/15 p-3", className)}>
      <dt className="text-xs font-medium uppercase tracking-wide text-ink/45">{label}</dt>
      <dd className="mt-0.5 font-medium text-pine">{value}{detail ? <span className="block text-xs font-normal text-ink/50">{detail}</span> : null}</dd>
    </div>
  );
}

