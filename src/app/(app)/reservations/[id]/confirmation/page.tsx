import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CalendarDays, CircleCheck, Clock, LogIn, LogOut, Mail, Phone, Plus, Users, Wallet } from "lucide-react";
import { buttonClassName } from "@/components/ui/button";
import { requireMembership } from "@/lib/auth/session";
import { CHARGE_TYPE_LABELS } from "@/lib/charges";
import { db } from "@/lib/db";
import { nightsBetween } from "@/lib/dates";
import { formatPHP } from "@/lib/money";
import { cn } from "@/lib/utils";
import { getReservationLedger } from "@/server/payments/service";
import { expireStaleHolds } from "@/server/reservations/holds";
import { getReservationDetail, ReservationError } from "@/server/reservations/service";
import { dayLabel, plural, timeLabel, UnitPhoto } from "../../../calendar/availability/stay-display";

export const metadata: Metadata = { title: "Reservation saved" };

export default async function ReservationConfirmationPage({ params }: { params: Promise<{ id: string }> }) {
  const membership = await requireMembership();
  const { id } = await params;
  const isOwner = membership.role === "owner";
  await expireStaleHolds(db, membership.organizationId);

  let detail;
  try {
    detail = await getReservationDetail(membership.organizationId, id);
  } catch (error) {
    if (error instanceof ReservationError) notFound();
    throw error;
  }
  const { reservation, guest, unit, property, charges } = detail;
  const occupants = detail.occupants ?? [];
  const ledger = isOwner ? await getReservationLedger(membership.organizationId, id) : null;
  const nights = nightsBetween(reservation.checkInDate, reservation.checkOutDate);
  const isHold = reservation.status === "hold";
  const expiresLabel = reservation.expiresAt
    ? new Intl.DateTimeFormat("en-PH", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: property?.timezone ?? "Asia/Manila" }).format(reservation.expiresAt)
    : null;
  const balances = ledger?.balances;
  const reservationHref = `/reservations/${reservation.id}`;
  const shortRef = reservation.id.slice(0, 8).toUpperCase();

  return (
    <div className="min-w-0 overflow-hidden">
      <section className={cn("rounded-2xl border p-6 sm:p-8", isHold ? "border-clay/20 bg-clay-mist/50" : "border-sage-deep/40 bg-sage/40")}>
        <div className="flex flex-wrap items-start gap-4">
          <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-full", isHold ? "bg-clay text-white" : "bg-pine text-white")}>
            {isHold ? <Clock className="h-6 w-6" aria-hidden /> : <CircleCheck className="h-6 w-6" aria-hidden />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-ink/50">Reservation {shortRef}</p>
            <h1 className="mt-1 font-display text-3xl tracking-tight text-pine sm:text-4xl">{isHold ? "Hold placed" : reservation.status === "confirmed" ? "Booking confirmed" : "Reservation saved"}</h1>
            <p className="mt-2 max-w-2xl text-sm text-ink/70">
              {guest.name} · {unit.name}, {dayLabel(reservation.checkInDate)} → {dayLabel(reservation.checkOutDate)}.
              {isHold && expiresLabel ? ` The dates are held until ${expiresLabel}; the hold releases automatically if it isn’t confirmed.` : " The dates are locked for this guest."}
            </p>
          </div>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <Link href={reservationHref} className={buttonClassName("clay", "md")}>Open reservation<ArrowRight className="h-4 w-4" aria-hidden /></Link>
            {isOwner && isHold ? <Link href={`${reservationHref}/confirm`} className={buttonClassName("outline", "md")}>Confirm hold</Link> : null}
            {isOwner && !isHold && balances && balances.bookingBalanceCents > 0 ? <Link href={`${reservationHref}/payments/new`} className={buttonClassName("outline", "md")}><Wallet className="h-4 w-4" aria-hidden />Record payment</Link> : null}
          </div>
        </div>
      </section>

      <div className="mt-8 grid min-w-0 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_24rem] 2xl:grid-cols-[minmax(0,1fr)_28rem]">
        <div className="min-w-0 space-y-6">
          <section className="overflow-hidden rounded-2xl border border-pine/10 bg-white shadow-[0_1px_2px_rgba(32,58,53,0.06)]">
            <div className="grid md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
              <UnitPhoto src={unit.imageUrl ?? property?.imageUrl ?? null} className="aspect-[16/10] md:aspect-auto md:min-h-64" />
              <div className="min-w-0 p-5 sm:p-6">
                {property ? <p className="truncate text-xs font-medium uppercase tracking-wide text-clay-deep">{property.name}</p> : null}
                <h2 className="mt-0.5 font-display text-2xl text-pine">{unit.name}</h2>
                {property?.address ? <p className="mt-1 text-sm text-ink/55">{property.address}</p> : null}
                <dl className="mt-5 grid gap-3 sm:grid-cols-2">
                  <Fact icon={LogIn} label="Check-in" value={dayLabel(reservation.checkInDate)} detail={`From ${timeLabel(unit.checkInTime)}`} />
                  <Fact icon={LogOut} label="Check-out" value={dayLabel(reservation.checkOutDate)} detail={`By ${timeLabel(unit.checkOutTime)}`} />
                  <Fact icon={CalendarDays} label="Length" value={plural(nights, "night")} />
                  <Fact icon={Users} label="Guests" value={plural(reservation.guestCount, "guest")} />
                </dl>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-pine/10 bg-white p-5 shadow-[0_1px_2px_rgba(32,58,53,0.06)] sm:p-6">
            <h2 className="font-display text-xl text-pine">Guests</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-xl bg-linen p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-ink/45">Primary guest</p>
                <p className="mt-1 font-medium text-pine">{guest.name}</p>
                <ul className="mt-2 space-y-1 text-sm text-ink/65">
                  {guest.email ? <li className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 shrink-0" aria-hidden /><span className="truncate">{guest.email}</span></li> : null}
                  {guest.phone ? <li className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 shrink-0" aria-hidden />{guest.phone}</li> : null}
                </ul>
              </div>
              <div className="rounded-xl bg-linen p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-ink/45">Also staying</p>
                {occupants.length ? <ul className="mt-1 space-y-1 text-sm text-pine">{occupants.map((occupant) => <li key={occupant.id}>{occupant.name}</li>)}</ul> : <p className="mt-1 text-sm text-ink/60">No one else</p>}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-pine/10 bg-white p-5 shadow-[0_1px_2px_rgba(32,58,53,0.06)] sm:p-6">
            <h2 className="font-display text-xl text-pine">What’s next</h2>
            <ul className="mt-4 grid gap-3 md:grid-cols-2">
              <NextStep href={reservationHref} title="Send the guest link" description="Share check-in details and let the guest upload payment proof." />
              <NextStep href={`/calendar?${new URLSearchParams({ unit: unit.id, month: reservation.checkInDate.slice(0, 7) })}`} title="See it on the calendar" description="Check the turnover and neighbouring stays." />
              <NextStep href="/calendar/availability" title="Check availability" description="Search open dates for another guest." />
              <NextStep href="/reservations/new" title="New reservation" description="Start another booking from scratch." icon={Plus} />
            </ul>
          </section>
        </div>

        <aside className="min-w-0 lg:sticky lg:top-0">
          <section className="rounded-2xl border border-pine/10 bg-white p-5 shadow-[0_1px_2px_rgba(32,58,53,0.06)]">
            <h2 className="font-display text-xl text-pine">Payment breakdown</h2>
            {isOwner && balances ? (
              <dl className="mt-4 space-y-2 text-sm">
                {charges.filter((charge) => charge.type !== "security_deposit").map((charge) => (
                  <div key={charge.id} className="flex justify-between gap-3 text-ink/70">
                    <dt className="min-w-0">
                      <span className="block truncate">{charge.description}</span>
                      <span className="text-xs text-ink/45">{CHARGE_TYPE_LABELS[charge.type]}{charge.quantity > 1 ? ` · ${charge.quantity} × ${formatPHP(charge.unitAmountCents)}` : ""}</span>
                    </dt>
                    <dd className={cn("shrink-0", charge.type === "discount" && "text-clay-deep")}>{formatPHP(charge.amountCents)}</dd>
                  </div>
                ))}
                <div className="flex justify-between gap-3 border-t border-pine/10 pt-2 font-medium text-pine"><dt>Booking total</dt><dd className="font-display text-lg">{formatPHP(balances.bookingTotalCents)}</dd></div>
                {balances.depositTotalCents ? <div className="flex justify-between gap-3 text-ink/70"><dt>Refundable deposit</dt><dd>{formatPHP(balances.depositTotalCents)}</dd></div> : null}
                <div className="flex justify-between gap-3 text-ink/70"><dt>Paid so far</dt><dd>{formatPHP(balances.paidBookingCents + balances.paidDepositCents)}</dd></div>
                <div className="flex justify-between gap-3 rounded-lg bg-linen px-3 py-2 font-medium text-pine">
                  <dt>Balance due</dt>
                  <dd>{formatPHP(Math.max(0, balances.bookingBalanceCents) + balances.depositOutstandingCents)}</dd>
                </div>
              </dl>
            ) : <p className="mt-2 text-sm text-ink/60">Priced at the unit’s default rates. The owner manages charges and payments.</p>}
          </section>
        </aside>
      </div>
    </div>
  );
}

function Fact({ icon: Icon, label, value, detail }: { icon: typeof LogIn; label: string; value: string; detail?: string }) {
  return (
    <div className="flex min-w-0 gap-3 rounded-xl bg-linen p-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sage/60 text-pine"><Icon className="h-4 w-4" aria-hidden /></span>
      <div className="min-w-0">
        <dt className="text-xs font-medium uppercase tracking-wide text-ink/45">{label}</dt>
        <dd className="mt-0.5 text-sm font-medium text-pine">{value}{detail ? <span className="block text-xs font-normal text-ink/55">{detail}</span> : null}</dd>
      </div>
    </div>
  );
}

function NextStep({ href, title, description, icon: Icon = ArrowRight }: { href: string; title: string; description: string; icon?: typeof ArrowRight }) {
  return (
    <li>
      <Link href={href} className="group flex h-full items-start justify-between gap-3 rounded-xl border border-pine/10 p-4 transition-colors hover:border-pine/25 hover:bg-linen">
        <span className="min-w-0">
          <span className="block font-medium text-pine">{title}</span>
          <span className="mt-0.5 block text-sm text-ink/60">{description}</span>
        </span>
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-pine/40 transition-transform group-hover:translate-x-0.5 group-hover:text-clay" aria-hidden />
      </Link>
    </li>
  );
}
