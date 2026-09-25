import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowRight, BedDouble, LogOut, Pencil, Plus } from "lucide-react";
import { requireMembership } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { RESERVATION_STATUS_LABELS } from "@/lib/labels";
import { CHARGE_TYPE_LABELS, computeTotals } from "@/lib/charges";
import { formatPHP } from "@/lib/money";
import { listNights } from "@/lib/dates";
import { getReservationDetail, isLiveHold, ReservationError } from "@/server/reservations/service";
import { expireStaleHolds } from "@/server/reservations/holds";
import { getReservationLedger } from "@/server/payments/service";
import { getTaskForReservation } from "@/server/operations/service";
import { PageHeading } from "@/components/app/page-heading";
import { Badge } from "@/components/ui/badge";
import { buttonClassName } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { GuestLinkCard } from "./guest-link-card";
import { PaymentsCard } from "./payments-card";

export const metadata: Metadata = { title: "Reservation" };

const DATE_LABEL = new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const TIME_LABEL = new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short" });
const STATUS_TONE: Record<string, "sage" | "clay" | "neutral"> = {
  hold: "clay", confirmed: "sage", checked_in: "sage", checked_out: "neutral", cancelled: "neutral", expired: "neutral",
};

function holdRemainingLabel(expiresAt: Date): string {
  const ms = expiresAt.getTime() - Date.now();
  if (ms <= 0) return "Expired";
  const minutes = Math.ceil(ms / 60_000);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} hour${hours === 1 ? "" : "s"}` : `${hours}h ${rest}m`;
}

export default async function ReservationDetailPage({ params }: { params: Promise<{ id: string }> }) {
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

  const { reservation, guest, unit, property, charges, transitions, activeToken } = detail;
  // Old reservation records and test doubles predate the optional occupant list.
  const occupants = detail.occupants ?? [];
  const ledger = isOwner ? await getReservationLedger(membership.organizationId, id) : null;
  const turnoverTask = reservation.status === "checked_out" ? await getTaskForReservation(membership.organizationId, id) : null;
  const totals = isOwner ? computeTotals(charges) : null;
  const nights = listNights(reservation.checkInDate, reservation.checkOutDate);
  const liveHold = isLiveHold(reservation.status, reservation.expiresAt);
  const moneyEditable = reservation.status !== "cancelled" && reservation.status !== "expired";
  const canCancel = isOwner && (liveHold || reservation.status === "confirmed");
  // Matches updateReservation: only an active hold or a confirmed booking is editable.
  const canEdit = isOwner && (liveHold || reservation.status === "confirmed");
  const canReportDamage = reservation.status === "checked_in" || reservation.status === "checked_out";
  const href = `/reservations/${reservation.id}`;

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeading title={guest.name} backHref="/reservations" backLabel="All reservations"
        description={`${unit.name}${property ? ` · ${property.name}` : ""} · ${DATE_LABEL.format(new Date(`${reservation.checkInDate}T00:00:00Z`))} – ${DATE_LABEL.format(new Date(`${reservation.checkOutDate}T00:00:00Z`))} · ${nights.length} ${nights.length === 1 ? "night" : "nights"}`}>
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone={STATUS_TONE[reservation.status] ?? "neutral"}>{RESERVATION_STATUS_LABELS[reservation.status]}</Badge>
          {canEdit ? <Link href={`${href}/edit`} className={buttonClassName("outline", "md")}><Pencil className="h-4 w-4" aria-hidden />Edit</Link> : null}
          {reservation.status === "confirmed" ? <Link href={`${href}/check-in`} className={buttonClassName("primary", "md")}><BedDouble className="h-4 w-4" aria-hidden />Check in</Link> : null}
          {reservation.status === "checked_in" ? <Link href={`${href}/check-out`} className={buttonClassName("primary", "md")}><LogOut className="h-4 w-4" aria-hidden />Check out</Link> : null}
          {isOwner && liveHold ? <Link href={`${href}/confirm`} className={buttonClassName("primary", "md")}>Confirm hold</Link> : null}
        </div>
      </PageHeading>

      {liveHold && reservation.expiresAt ? <p className="mb-6 rounded-xl border border-clay/30 bg-clay-mist/60 px-4 py-3 text-sm text-clay-deep" role="status">This hold releases in {holdRemainingLabel(reservation.expiresAt)} ({TIME_LABEL.format(reservation.expiresAt)}). Confirm it before then to keep the dates.</p> : null}
      {reservation.status === "expired" ? <p className="mb-6 rounded-xl border border-pine/15 bg-paper px-4 py-3 text-sm text-ink/70">This hold expired and the dates were released. <Link href="/reservations/new" className="font-medium text-clay underline underline-offset-4">Create a new reservation</Link> if the guest still wants the stay.</p> : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem] xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader><h2 className="font-display text-lg text-pine">Guest information & stay</h2></CardHeader>
            <CardBody>
              <dl className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                <div><dt className="text-xs font-medium uppercase tracking-wide text-ink/45">Guest</dt><dd className="mt-1 text-sm font-medium text-pine">{guest.name}</dd></div>
                <div><dt className="text-xs font-medium uppercase tracking-wide text-ink/45">Email</dt><dd className="mt-1 break-words text-sm text-pine">{guest.email ?? "—"}</dd></div>
                <div><dt className="text-xs font-medium uppercase tracking-wide text-ink/45">Phone</dt><dd className="mt-1 text-sm text-pine">{guest.phone ?? "—"}</dd></div>
                <div><dt className="text-xs font-medium uppercase tracking-wide text-ink/45">Check-in</dt><dd className="mt-1 text-sm text-pine">{DATE_LABEL.format(new Date(`${reservation.checkInDate}T00:00:00Z`))}</dd></div>
                <div><dt className="text-xs font-medium uppercase tracking-wide text-ink/45">Check-out</dt><dd className="mt-1 text-sm text-pine">{DATE_LABEL.format(new Date(`${reservation.checkOutDate}T00:00:00Z`))}</dd></div>
                <div><dt className="text-xs font-medium uppercase tracking-wide text-ink/45">Guests</dt><dd className="mt-1 text-sm text-pine">{reservation.guestCount} {reservation.guestCount === 1 ? "guest" : "guests"}</dd></div>
              </dl>
              {guest.notes ? <p className="mt-5 border-t border-pine/10 pt-4 text-sm text-ink/60">{guest.notes}</p> : null}
              {occupants.length > 0 ? <div className="mt-5 border-t border-pine/10 pt-4"><p className="text-xs font-medium uppercase tracking-wide text-ink/45">Additional guests</p><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-pine">{occupants.map((occupant) => <li key={occupant.id}>{occupant.name}</li>)}</ul></div> : null}
              {reservation.actualCheckoutAt ? <p className="mt-4 border-t border-pine/10 pt-3 text-sm text-ink/60"><span className="font-medium text-ink">Actual check-out:</span> {new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: property?.timezone ?? "Asia/Manila" }).format(reservation.actualCheckoutAt)}</p> : null}
              {reservation.confirmReason ? <p className="mt-4 border-t border-pine/10 pt-3 text-sm text-ink/60"><span className="font-medium text-ink">Confirmed because:</span> {reservation.confirmReason}</p> : null}
              {reservation.cancelReason ? <p className="mt-4 border-t border-pine/10 pt-3 text-sm text-ink/60"><span className="font-medium text-ink">Cancelled because:</span> {reservation.cancelReason}</p> : null}
            </CardBody>
          </Card>

          {isOwner && ledger && totals ? (
            <>
              <Card>
                <CardHeader><h2 className="font-display text-lg text-pine">Booking charges</h2></CardHeader>
                <CardBody>
                  <Table aria-label="Booking charges">
                    <TableHeader><TableRow><TableHead>Description</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Unit price</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {charges.map((charge) => (
                        <TableRow key={charge.id}>
                          <TableCell><p className="min-w-40 text-pine">{charge.description}</p><p className="mt-1 text-xs text-ink/45">{CHARGE_TYPE_LABELS[charge.type]}</p></TableCell>
                          <TableCell className="text-right text-ink/70">{charge.quantity}</TableCell>
                          <TableCell className="whitespace-nowrap text-right text-ink/70">{formatPHP(charge.unitAmountCents)}</TableCell>
                          <TableCell className="whitespace-nowrap text-right font-medium text-pine">{formatPHP(charge.amountCents)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableFooter>
                      <TableRow><TableCell colSpan={3}>Booking total (excl. deposit)</TableCell><TableCell className="whitespace-nowrap text-right font-semibold text-pine">{formatPHP(totals.bookingTotalCents)}</TableCell></TableRow>
                      <TableRow><TableCell colSpan={3}>Refundable deposit</TableCell><TableCell className="whitespace-nowrap text-right text-pine">{formatPHP(totals.depositTotalCents)}</TableCell></TableRow>
                    </TableFooter>
                  </Table>
                  <p className="mt-4 text-xs leading-relaxed text-ink/55">The security deposit is not part of the booking total and does not reduce the booking balance.</p>
                </CardBody>
              </Card>
              <PaymentsCard reservationId={reservation.id} ledger={ledger} isOwner={isOwner} canRecord={moneyEditable} />
            </>
          ) : null}

          <Card>
            <CardHeader><h2 className="font-display text-lg text-pine">History</h2></CardHeader>
            <CardBody>
              <ol className="space-y-5 border-l border-sage pl-5">
                {transitions.map((transition) => (
                  <li key={transition.id} className="relative">
                    <span className="absolute -left-[1.6rem] top-1.5 h-2.5 w-2.5 rounded-full bg-pine ring-4 ring-white" aria-hidden />
                    <p className="text-sm font-medium text-pine">{transition.fromStatus ? `${RESERVATION_STATUS_LABELS[transition.fromStatus]} → ` : "Created as "}{RESERVATION_STATUS_LABELS[transition.toStatus]}</p>
                    {transition.note ? <p className="mt-1 text-sm text-ink/55">{transition.note}</p> : null}
                    <p className="mt-1 text-xs text-ink/45">{TIME_LABEL.format(transition.createdAt)}</p>
                  </li>
                ))}
              </ol>
            </CardBody>
          </Card>
        </div>

        <aside className="min-w-0 space-y-6" aria-label="Reservation actions">
          <Card>
            <CardHeader><h2 className="font-display text-lg text-pine">Manage reservation</h2></CardHeader>
            <CardBody className="space-y-4">
              <p className="text-sm leading-relaxed text-ink/60">Open an action to review its details before saving.</p>
              <div className="space-y-2">
                {isOwner && liveHold ? <Link href={`${href}/confirm`} className={buttonClassName("outline", "md", "w-full justify-between")}>Confirm hold<ArrowRight className="h-4 w-4" aria-hidden /></Link> : null}
                {reservation.status === "confirmed" ? <Link href={`${href}/check-in`} className={buttonClassName("outline", "md", "w-full justify-between")}>Check in guest<ArrowRight className="h-4 w-4" aria-hidden /></Link> : null}
                {reservation.status === "checked_in" ? <Link href={`${href}/check-out`} className={buttonClassName("outline", "md", "w-full justify-between")}>Check out guest<ArrowRight className="h-4 w-4" aria-hidden /></Link> : null}
                {canEdit ? <Link href={`${href}/edit`} className={buttonClassName("outline", "md", "w-full justify-between")}>Edit reservation<Pencil className="h-4 w-4" aria-hidden /></Link> : null}
                {canReportDamage ? <Link href={`${href}/damage/new`} className={buttonClassName("outline", "md", "w-full justify-between")}>Report damage<Plus className="h-4 w-4" aria-hidden /></Link> : null}
                {canCancel ? <Link href={`${href}/cancel`} className={buttonClassName("ghost", "md", "w-full justify-start text-clay")}>{reservation.status === "hold" ? "Cancel hold" : "Cancel reservation"}</Link> : null}
                {!liveHold && !canReportDamage && reservation.status !== "confirmed" ? <Link href="/reservations/new" className={buttonClassName("clay", "md", "w-full")}><Plus className="h-4 w-4" aria-hidden />New reservation</Link> : null}
                {liveHold && !isOwner ? <p className="text-sm text-ink/60">The owner can confirm or cancel this hold.</p> : null}
              </div>
            </CardBody>
          </Card>

          {isOwner && moneyEditable ? (
            <Card>
              <CardHeader><h2 className="font-display text-lg text-pine">Money actions</h2></CardHeader>
              <CardBody className="space-y-2">
                <Link href={`${href}/payments/new`} className={buttonClassName("clay", "md", "w-full")}><Plus className="h-4 w-4" aria-hidden />Record payment</Link>
                <Link href={`${href}/refunds/new`} className={buttonClassName("outline", "md", "w-full")}>Record refund</Link>
                {totals && totals.depositTotalCents > 0 ? <Link href={`${href}/deductions/new`} className={buttonClassName("outline", "md", "w-full")}>Record deposit deduction</Link> : null}
              </CardBody>
            </Card>
          ) : null}

          {isOwner ? (
            <Card>
              <CardHeader><h2 className="font-display text-lg text-pine">Guest link</h2></CardHeader>
              <CardBody><GuestLinkCard reservationId={reservation.id} activeToken={activeToken ? { id: activeToken.id, createdAt: activeToken.createdAt, expiresAt: activeToken.expiresAt } : null} /></CardBody>
            </Card>
          ) : null}

          {turnoverTask ? (
            <Card>
              <CardHeader><h2 className="font-display text-lg text-pine">Turnover</h2></CardHeader>
              <CardBody>
                <p className="text-sm text-ink/70">{turnoverTask.doneItems} of {turnoverTask.totalItems} checklist items done.</p>
                <Link href={`/tasks/${turnoverTask.id}`} className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-pine underline-offset-4 hover:underline">Open turnover task<ArrowRight className="h-4 w-4" aria-hidden /></Link>
              </CardBody>
            </Card>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
