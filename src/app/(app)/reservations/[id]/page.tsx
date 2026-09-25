import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Ban,
  BedDouble,
  CalendarDays,
  Check,
  CircleAlert,
  Clock,
  LogIn,
  LogOut,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Users,
  Wallet,
} from "lucide-react";
import { requireMembership } from "@/lib/auth/session";
import { db } from "@/lib/db";
import type { ReservationStatus } from "@/lib/db/schema";
import { RESERVATION_STATUS_LABELS } from "@/lib/labels";
import { CHARGE_TYPE_LABELS, computeTotals } from "@/lib/charges";
import { formatPHP } from "@/lib/money";
import { listNights } from "@/lib/dates";
import { cn } from "@/lib/utils";
import {
  getReservationDetail,
  isLiveHold,
  ReservationError,
} from "@/server/reservations/service";
import { expireStaleHolds } from "@/server/reservations/holds";
import { getReservationLedger } from "@/server/payments/service";
import { getTaskForReservation } from "@/server/operations/service";
import { ReservationStatusBadge } from "@/components/app/reservation-status-badge";
import { buttonClassName } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  dayLabel,
  plural,
  timeLabel,
  UnitPhoto,
} from "../../calendar/availability/stay-display";
import { GuestLinkCard } from "./guest-link-card";
import { PaymentsCard } from "./payments-card";
import { ReservationHistory } from "./reservation-history";

export const metadata: Metadata = { title: "Reservation" };

function holdRemainingLabel(expiresAt: Date): string {
  const ms = expiresAt.getTime() - Date.now();
  if (ms <= 0) return "Expired";
  const minutes = Math.ceil(ms / 60_000);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0
    ? `${hours} hour${hours === 1 ? "" : "s"}`
    : `${hours}h ${rest}m`;
}

/** The happy path a stay moves through; cancelled/expired end it early. */
const PROGRESS: { status: ReservationStatus; label: string }[] = [
  { status: "hold", label: "Booked" },
  { status: "confirmed", label: "Confirmed" },
  { status: "checked_in", label: "Checked in" },
  { status: "checked_out", label: "Checked out" },
];

export default async function ReservationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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

  const {
    reservation,
    guest,
    unit,
    property,
    charges,
    transitions,
    activeToken,
  } = detail;
  // Old reservation records and test doubles predate the optional occupant list.
  const occupants = detail.occupants ?? [];
  const ledger = isOwner
    ? await getReservationLedger(membership.organizationId, id)
    : null;
  const turnoverTask =
    reservation.status === "checked_out"
      ? await getTaskForReservation(membership.organizationId, id)
      : null;
  const totals = isOwner ? computeTotals(charges) : null;
  const nights = listNights(reservation.checkInDate, reservation.checkOutDate);
  const liveHold = isLiveHold(reservation.status, reservation.expiresAt);
  const moneyEditable =
    reservation.status !== "cancelled" && reservation.status !== "expired";
  const canCancel = isOwner && (liveHold || reservation.status === "confirmed");
  // Matches updateReservation: only an active hold or a confirmed booking is editable.
  const canEdit = isOwner && (liveHold || reservation.status === "confirmed");
  const canReportDamage =
    reservation.status === "checked_in" || reservation.status === "checked_out";
  const href = `/reservations/${reservation.id}`;

  const timezone = property?.timezone ?? "Asia/Manila";
  const timeFormat = new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
  });
  const checkInTime = unit.checkInTime ?? property?.checkInTime ?? null;
  const checkOutTime = unit.checkOutTime ?? property?.checkOutTime ?? null;
  const balances = ledger?.balances ?? null;
  const balanceDue = balances ? Math.max(0, balances.bookingBalanceCents) : 0;
  const paidShare =
    balances && balances.bookingTotalCents > 0
      ? Math.min(1, balances.paidBookingCents / balances.bookingTotalCents)
      : 0;
  const ended =
    reservation.status === "cancelled" || reservation.status === "expired";
  // Only money actually received can be refunded or deducted from.
  const canRefund = Boolean(
    balances &&
    (balances.paidBookingCents - balances.refundedBookingCents > 0 ||
      balances.depositHeldCents > 0),
  );
  const canDeduct = Boolean(
    balances &&
    totals &&
    totals.depositTotalCents > 0 &&
    balances.depositHeldCents > 0,
  );

  // When each progress step was reached, from the transition history.
  const reachedAt = new Map<ReservationStatus, Date>();
  for (const transition of transitions)
    if (!reachedAt.has(transition.toStatus))
      reachedAt.set(transition.toStatus, transition.createdAt);
  const firstTransition = transitions[0];
  if (firstTransition) reachedAt.set("hold", firstTransition.createdAt);
  const currentStep = PROGRESS.findIndex(
    (step) => step.status === reservation.status,
  );
  // For a cancelled/expired stay: the furthest step it reached before ending.
  const lastReached = Math.max(
    ...PROGRESS.map((step, index) => (reachedAt.has(step.status) ? index : 0)),
  );

  return (
    <div className="min-w-0 overflow-hidden">
      <Link
        href="/reservations"
        className="mb-4 inline-flex items-center gap-2 text-sm text-pine/70 hover:text-clay"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        All reservations
      </Link>

      <section className="overflow-hidden rounded-2xl border border-pine/10 bg-white shadow-[0_1px_2px_rgba(32,58,53,0.06)]">
        <div className="grid md:grid-cols-[16rem_minmax(0,1fr)] xl:grid-cols-[20rem_minmax(0,1fr)]">
          <UnitPhoto
            src={unit.imageUrl ?? property?.imageUrl ?? null}
            className="aspect-[16/9] md:aspect-auto md:h-full md:min-h-56"
          />
          <div className="@container flex min-w-0 flex-col gap-5 p-5 sm:p-6">
            {/* Who and what on the left, the next actions on the right. */}
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <ReservationStatusBadge status={reservation.status} />
                <span className="font-mono text-xs text-ink/50">
                  #{reservation.id.slice(0, 8).toUpperCase()}
                </span>
                {reservation.createdAt ? (
                  <span className="text-xs text-ink/50">
                    Booked {timeFormat.format(reservation.createdAt)}
                  </span>
                ) : null}
              </div>
              <h1 className="mt-3 truncate font-display text-3xl tracking-tight text-pine sm:text-4xl">
                {guest.name}
              </h1>
              <p className="mt-1.5 flex items-center gap-1.5 text-sm text-ink/65">
                <MapPin className="h-4 w-4 shrink-0 text-pine/45" aria-hidden />
                <span className="truncate">
                  {unit.name}
                  {property ? ` · ${property.name}` : ""}
                </span>
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 xl:justify-end">
              {isOwner && liveHold ? (
                <Link
                  href={`${href}/confirm`}
                  className={buttonClassName("clay", "md")}
                >
                  <Check className="h-4 w-4" aria-hidden />
                  Confirm hold
                </Link>
              ) : null}
              {reservation.status === "confirmed" ? (
                <Link
                  href={`${href}/check-in`}
                  className={buttonClassName("clay", "md")}
                >
                  <BedDouble className="h-4 w-4" aria-hidden />
                  Check in
                </Link>
              ) : null}
              {reservation.status === "checked_in" ? (
                <Link
                  href={`${href}/check-out`}
                  className={buttonClassName("clay", "md")}
                >
                  <LogOut className="h-4 w-4" aria-hidden />
                  Check out
                </Link>
              ) : null}
              {canEdit ? (
                <Link
                  href={`${href}/edit`}
                  className={buttonClassName("outline", "md")}
                >
                  <Pencil className="h-4 w-4" aria-hidden />
                  Edit
                </Link>
              ) : null}
              <Link
                href={`/calendar?${new URLSearchParams({ unit: unit.id, month: reservation.checkInDate.slice(0, 7) })}`}
                className={buttonClassName("ghost", "md")}
              >
                <CalendarDays className="h-4 w-4" aria-hidden />
                Calendar
              </Link>
            </div>
            </div>

            <dl
              className={cn(
                // Sized by the hero's own width, not the screen: beside the photo there is less room.
                "grid grid-cols-2 gap-2.5 @3xl:grid-cols-3",
              )}
            >
        <StayRangeCard
          checkIn={dayLabel(reservation.checkInDate)}
          checkInDetail={checkInTime ? `From ${timeLabel(checkInTime)}` : undefined}
          checkOut={dayLabel(reservation.checkOutDate)}
          checkOutDetail={checkOutTime ? `By ${timeLabel(checkOutTime)}` : undefined}
          nights={nights.length}
        />
        <StatTile
          icon={Users}
          label="Guests"
          value={String(reservation.guestCount)}
        />
        {isOwner && balances ? (
          <>
            <StatTile
              icon={Wallet}
              label="Total"
              value={formatPHP(balances.bookingTotalCents)}
              detail={
                balances.depositTotalCents
                  ? `+ ${formatPHP(balances.depositTotalCents)} deposit`
                  : undefined
              }
            />
            <BalanceCard
              balanceCents={balances.bookingBalanceCents}
              paidShare={paidShare}
              href={moneyEditable && balanceDue > 0 ? `${href}/payments/new` : undefined}
              muted={ended}
            />
          </>
        ) : null}
            </dl>
          </div>
        </div>
      </section>

      {liveHold && reservation.expiresAt ? (
        <p
          className="mt-4 flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          role="status"
        >
          <Clock className="h-4 w-4 shrink-0" aria-hidden />
          This hold releases in{" "}
          <strong>{holdRemainingLabel(reservation.expiresAt)}</strong> (
          {timeFormat.format(reservation.expiresAt)}). Confirm it before then to
          keep the dates.
        </p>
      ) : null}
      {reservation.status === "expired" ? (
        <p className="mt-4 flex items-center gap-2 rounded-xl border border-pine/15 bg-paper px-4 py-3 text-sm text-ink/70">
          <CircleAlert className="h-4 w-4 shrink-0" aria-hidden />
          <span>
            This hold expired and the dates were released.{" "}
            <Link
              href="/reservations/new"
              className="font-medium text-clay underline underline-offset-4"
            >
              Create a new reservation
            </Link>{" "}
            if the guest still wants the stay.
          </span>
        </p>
      ) : null}


      <div className="mt-6 grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0 space-y-6">
          <section className="rounded-2xl border border-pine/10 bg-white p-5 shadow-[0_1px_2px_rgba(32,58,53,0.06)] sm:p-6">
            <h2 className="font-display text-lg text-pine">Stay progress</h2>
            <ol className="mt-5 grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
              {PROGRESS.map((step, index) => {
                const isDone = (i: number) =>
                  ended
                    ? i <= lastReached
                    : i < currentStep || reservation.status === "checked_out";
                const done = isDone(index);
                const prevDone = index > 0 && isDone(index - 1);
                const current =
                  !ended &&
                  index === currentStep &&
                  reservation.status !== "checked_out";
                const at = reachedAt.get(step.status);
                const label =
                  step.status === "hold" &&
                  firstTransition?.toStatus === "confirmed"
                    ? "Booked"
                    : step.label;
                const isLast = index === PROGRESS.length - 1;
                return (
                  <li
                    key={step.status}
                    className={cn(
                      "relative flex min-w-0 items-start gap-3 sm:flex-col sm:gap-2",
                      isLast && "sm:items-end",
                    )}
                  >
                    {!isLast ? (
                      <span
                        aria-hidden
                        className={cn(
                          "absolute left-4 top-8 h-[calc(100%-1rem)] w-0.5 sm:-right-3 sm:left-8 sm:top-4 sm:h-0.5 sm:w-auto",
                          done ? "bg-pine" : "bg-pine/10",
                        )}
                      />
                    ) : (
                      <span
                        aria-hidden
                        className={cn(
                          "absolute hidden sm:left-0 sm:right-8 sm:top-4 sm:block sm:h-0.5",
                          prevDone ? "bg-pine" : "bg-pine/10",
                        )}
                      />
                    )}
                    <span
                      className={cn(
                        "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ring-4 ring-white",
                        done
                          ? "bg-pine text-white"
                          : current
                            ? "bg-clay text-white"
                            : "bg-pine/10 text-ink/45",
                      )}
                    >
                      {done ? (
                        <Check className="h-4 w-4" aria-hidden />
                      ) : (
                        index + 1
                      )}
                    </span>
                    <div className={cn("min-w-0", isLast && "sm:text-right")}>
                      <p
                        className={cn(
                          "text-sm font-medium",
                          done || current ? "text-pine" : "text-ink/45",
                        )}
                      >
                        {label}
                      </p>
                      <p className="text-xs text-ink/50">
                        {at && (done || current)
                          ? timeFormat.format(at)
                          : current
                            ? "Now"
                            : "—"}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
            {ended ? (
              <p className="mt-5 flex items-start gap-2 rounded-xl bg-clay-mist/60 px-4 py-3 text-sm text-clay-deep">
                <Ban className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>
                  {RESERVATION_STATUS_LABELS[reservation.status]}
                  {reachedAt.get(reservation.status)
                    ? ` ${timeFormat.format(reachedAt.get(reservation.status)!)}`
                    : ""}
                  .
                  {reservation.cancelReason
                    ? ` Reason: ${reservation.cancelReason}`
                    : ""}
                </span>
              </p>
            ) : null}
            {reservation.actualCheckoutAt ? (
              <p className="mt-4 text-sm text-ink/60">
                <span className="font-medium text-ink">Actual check-out:</span>{" "}
                {timeFormat.format(reservation.actualCheckoutAt)}
              </p>
            ) : null}
            {reservation.confirmReason ? (
              <p className="mt-2 text-sm text-ink/60">
                <span className="font-medium text-ink">Confirmed because:</span>{" "}
                {reservation.confirmReason}
              </p>
            ) : null}
          </section>

          <section className="rounded-2xl border border-pine/10 bg-white p-5 shadow-[0_1px_2px_rgba(32,58,53,0.06)] sm:p-6">
            <h2 className="font-display text-lg text-pine">Guests</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="min-w-0 rounded-xl bg-linen p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-ink/45">
                  Primary guest
                </p>
                <p className="mt-1 truncate font-medium text-pine">
                  {guest.name}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {guest.email ? (
                    <a
                      href={`mailto:${guest.email}`}
                      className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-pine/15 bg-white px-2.5 py-1.5 text-sm text-pine hover:border-pine/35"
                    >
                      <Mail
                        className="h-3.5 w-3.5 shrink-0 text-pine/55"
                        aria-hidden
                      />
                      <span className="truncate">{guest.email}</span>
                    </a>
                  ) : null}
                  {guest.phone ? (
                    <a
                      href={`tel:${guest.phone}`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-pine/15 bg-white px-2.5 py-1.5 text-sm text-pine hover:border-pine/35"
                    >
                      <Phone
                        className="h-3.5 w-3.5 shrink-0 text-pine/55"
                        aria-hidden
                      />
                      {guest.phone}
                    </a>
                  ) : null}
                  {!guest.email && !guest.phone ? (
                    <p className="text-sm text-ink/55">No contact details</p>
                  ) : null}
                </div>
                {guest.notes ? (
                  <p className="mt-3 border-t border-pine/10 pt-3 text-sm text-ink/65">
                    {guest.notes}
                  </p>
                ) : null}
              </div>
              <div className="min-w-0 rounded-xl bg-linen p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-ink/45">
                  Also staying
                </p>
                {occupants.length ? (
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {occupants.map((occupant) => (
                      <li
                        key={occupant.id}
                        className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-sm text-pine ring-1 ring-pine/10"
                      >
                        <Users
                          className="h-3.5 w-3.5 text-pine/50"
                          aria-hidden
                        />
                        {occupant.name}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-sm text-ink/60">
                    {reservation.guestCount > 1
                      ? `${plural(reservation.guestCount - 1, "guest")} not named yet`
                      : "Only the primary guest"}
                  </p>
                )}
              </div>
            </div>
          </section>

          {isOwner && ledger && totals ? (
            <>
              <Card>
                <CardHeader>
                  <h2 className="font-display text-lg text-pine">
                    Booking charges
                  </h2>
                </CardHeader>
                <CardBody>
                  <Table aria-label="Booking charges">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Description</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Unit price</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {charges.map((charge) => (
                        <TableRow key={charge.id}>
                          <TableCell className="min-w-40 text-pine">
                            {charge.description}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-ink/55">
                            {CHARGE_TYPE_LABELS[charge.type]}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-ink/70">
                            {charge.quantity}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-right tabular-nums text-ink/70">
                            {formatPHP(charge.unitAmountCents)}
                          </TableCell>
                          <TableCell
                            className={cn(
                              "whitespace-nowrap text-right font-medium tabular-nums",
                              charge.type === "discount"
                                ? "text-clay-deep"
                                : "text-pine",
                            )}
                          >
                            {formatPHP(charge.amountCents)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableFooter>
                      <TableRow>
                        <TableCell colSpan={4}>
                          Booking total (excl. deposit)
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right font-semibold text-pine">
                          {formatPHP(totals.bookingTotalCents)}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell colSpan={4}>Refundable deposit</TableCell>
                        <TableCell className="whitespace-nowrap text-right text-pine">
                          {formatPHP(totals.depositTotalCents)}
                        </TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>
                  <p className="mt-4 text-xs leading-relaxed text-ink/55">
                    The security deposit is not part of the booking total and
                    does not reduce the booking balance.
                  </p>
                </CardBody>
              </Card>
              <PaymentsCard
                reservationId={reservation.id}
                ledger={ledger}
                isOwner={isOwner}
                canRecord={moneyEditable}
              />
            </>
          ) : null}

          <section className="rounded-2xl border border-pine/10 bg-white p-5 shadow-[0_1px_2px_rgba(32,58,53,0.06)] sm:p-6">
            <h2 className="font-display text-lg text-pine">History</h2>
            <ReservationHistory transitions={transitions} ledger={ledger} timeZone={timezone} />
          </section>
        </div>

        <aside
          className="min-w-0 space-y-6 lg:sticky lg:top-0"
          aria-label="Reservation actions"
        >
          {isOwner && balances ? (
            <section className="rounded-2xl border border-pine/10 bg-white p-5 shadow-[0_1px_2px_rgba(32,58,53,0.06)]">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-display text-lg text-pine">Balance</h2>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                    balanceDue > 0
                      ? "bg-clay-mist text-clay-deep"
                      : "bg-sage text-pine-deep",
                  )}
                >
                  {balanceDue > 0
                    ? `${Math.round(paidShare * 100)}% paid`
                    : "Paid"}
                </span>
              </div>
              <p className="mt-3 font-display text-3xl text-pine">
                {formatPHP(balanceDue)}
              </p>
              <p className="text-sm text-ink/55">
                due of {formatPHP(balances.bookingTotalCents)}
              </p>
              <div
                className="mt-4 h-2 overflow-hidden rounded-full bg-pine/10"
                role="progressbar"
                aria-label="Paid towards booking"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(paidShare * 100)}
              >
                <div
                  className="h-full rounded-full bg-pine"
                  style={{ width: `${paidShare * 100}%` }}
                />
              </div>
              <dl className="mt-4 space-y-1.5 text-sm">
                <div className="flex justify-between gap-3 text-ink/65">
                  <dt>Paid</dt>
                  <dd className="tabular-nums">
                    {formatPHP(balances.paidBookingCents)}
                  </dd>
                </div>
                {balances.depositTotalCents ? (
                  <div className="flex justify-between gap-3 text-ink/65">
                    <dt>Deposit held</dt>
                    <dd className="tabular-nums">
                      {formatPHP(balances.depositHeldCents)} of{" "}
                      {formatPHP(balances.depositTotalCents)}
                    </dd>
                  </div>
                ) : null}
              </dl>
              {moneyEditable ? (
                <div className="mt-5 grid gap-2">
                  <Link
                    href={`${href}/payments/new`}
                    className={buttonClassName("clay", "md", "w-full")}
                  >
                    <Plus className="h-4 w-4" aria-hidden />
                    Record payment
                  </Link>
                  <div className="grid grid-cols-2 gap-2">
                    {canRefund ? (
                      <Link
                        href={`${href}/refunds/new`}
                        className={buttonClassName("outline", "sm", "w-full")}
                      >
                        Record refund
                      </Link>
                    ) : (
                      <DisabledAction reason="No payment recorded yet">
                        Record refund
                      </DisabledAction>
                    )}
                    {canDeduct ? (
                      <Link
                        href={`${href}/deductions/new`}
                        className={buttonClassName("outline", "sm", "w-full")}
                      >
                        Deposit deduction
                      </Link>
                    ) : (
                      <DisabledAction
                        reason={
                          totals && totals.depositTotalCents > 0
                            ? "No deposit collected yet"
                            : "No deposit on this booking"
                        }
                      >
                        Deposit deduction
                      </DisabledAction>
                    )}
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}

          <section className="rounded-2xl border border-pine/10 bg-white p-5 shadow-[0_1px_2px_rgba(32,58,53,0.06)]">
            <h2 className="font-display text-lg text-pine">
              Manage reservation
            </h2>
            <div className="mt-4 space-y-2">
              {isOwner && liveHold ? (
                <Link
                  href={`${href}/confirm`}
                  className={buttonClassName(
                    "outline",
                    "md",
                    "w-full justify-between",
                  )}
                >
                  Confirm hold
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              ) : null}
              {reservation.status === "confirmed" ? (
                <Link
                  href={`${href}/check-in`}
                  className={buttonClassName(
                    "outline",
                    "md",
                    "w-full justify-between",
                  )}
                >
                  Check in guest
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              ) : null}
              {reservation.status === "checked_in" ? (
                <Link
                  href={`${href}/check-out`}
                  className={buttonClassName(
                    "outline",
                    "md",
                    "w-full justify-between",
                  )}
                >
                  Check out guest
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              ) : null}
              {canEdit ? (
                <Link
                  href={`${href}/edit`}
                  className={buttonClassName(
                    "outline",
                    "md",
                    "w-full justify-between",
                  )}
                >
                  Edit reservation
                  <Pencil className="h-4 w-4" aria-hidden />
                </Link>
              ) : null}
              {canReportDamage ? (
                <Link
                  href={`${href}/damage/new`}
                  className={buttonClassName(
                    "outline",
                    "md",
                    "w-full justify-between",
                  )}
                >
                  Report damage
                  <Plus className="h-4 w-4" aria-hidden />
                </Link>
              ) : null}
              {canCancel ? (
                <Link
                  href={`${href}/cancel`}
                  className={buttonClassName(
                    "ghost",
                    "md",
                    "w-full justify-start text-clay",
                  )}
                >
                  {reservation.status === "hold"
                    ? "Cancel hold"
                    : "Cancel reservation"}
                </Link>
              ) : null}
              {!liveHold &&
              !canReportDamage &&
              reservation.status !== "confirmed" ? (
                <Link
                  href="/reservations/new"
                  className={buttonClassName("clay", "md", "w-full")}
                >
                  <Plus className="h-4 w-4" aria-hidden />
                  New reservation
                </Link>
              ) : null}
              {liveHold && !isOwner ? (
                <p className="text-sm text-ink/60">
                  The owner can confirm or cancel this hold.
                </p>
              ) : null}
            </div>
          </section>

          {isOwner ? (
            <section className="rounded-2xl border border-pine/10 bg-white p-5 shadow-[0_1px_2px_rgba(32,58,53,0.06)]">
              <h2 className="font-display text-lg text-pine">Guest link</h2>
              <div className="mt-4">
                <GuestLinkCard
                  reservationId={reservation.id}
                  activeToken={
                    activeToken
                      ? {
                          id: activeToken.id,
                          createdAt: activeToken.createdAt,
                          expiresAt: activeToken.expiresAt,
                        }
                      : null
                  }
                />
              </div>
            </section>
          ) : null}

          {turnoverTask ? (
            <section className="rounded-2xl border border-pine/10 bg-white p-5 shadow-[0_1px_2px_rgba(32,58,53,0.06)]">
              <h2 className="font-display text-lg text-pine">Turnover</h2>
              <p className="mt-3 text-sm text-ink/70">
                {turnoverTask.doneItems} of {turnoverTask.totalItems} checklist
                items done.
              </p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-pine/10">
                <div
                  className="h-full rounded-full bg-sage-deep"
                  style={{
                    width: `${turnoverTask.totalItems ? (turnoverTask.doneItems / turnoverTask.totalItems) * 100 : 0}%`,
                  }}
                />
              </div>
              <Link
                href={`/tasks/${turnoverTask.id}`}
                className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-pine underline-offset-4 hover:underline"
              >
                Open turnover task
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

/** An action that exists but can't be used yet, with the reason on hover and for screen readers. */
function DisabledAction({
  reason,
  children,
}: {
  reason: string;
  children: React.ReactNode;
}) {
  return (
    <span
      role="link"
      aria-disabled="true"
      title={reason}
      className={buttonClassName(
        "outline",
        "sm",
        "w-full cursor-not-allowed opacity-45",
      )}
    >
      {children}
      <span className="sr-only"> ({reason})</span>
    </span>
  );
}

/** Check-in and check-out as one card, with the length of stay between them. */
function StayRangeCard({ checkIn, checkInDetail, checkOut, checkOutDetail, nights }: {
  checkIn: string;
  checkInDetail?: string;
  checkOut: string;
  checkOutDetail?: string;
  nights: number;
}) {
  return (
    <div className="col-span-2 flex min-w-0 items-center gap-3 rounded-xl bg-linen p-3 sm:gap-4 sm:p-4">
      <div className="flex min-w-0 items-center gap-3">
        <span className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sage/60 text-pine sm:flex"><LogIn className="h-5 w-5" aria-hidden /></span>
        <div className="min-w-0">
          <dt className="text-xs font-medium uppercase tracking-wide text-ink/45">Check-in</dt>
          <dd className="mt-0.5 truncate font-display text-lg text-pine">{checkIn}</dd>
          {checkInDetail ? <dd className="truncate text-xs text-ink/55">{checkInDetail}</dd> : null}
        </div>
      </div>
      <div className="flex min-w-[5.5rem] flex-1 items-center" aria-hidden>
        <span className="h-px flex-1 border-t border-dashed border-pine/25" />
        <span className="mx-2 inline-flex shrink-0 items-center gap-1 rounded-full bg-pine-mist px-2.5 py-1 text-xs font-medium text-pine"><BedDouble className="h-3.5 w-3.5" />{nights}<span className="hidden sm:inline"> {nights === 1 ? "night" : "nights"}</span></span>
        <span className="h-px flex-1 border-t border-dashed border-pine/25" />
      </div>
      <dt className="sr-only">Nights</dt>
      <dd className="sr-only">{nights}</dd>
      <div className="flex min-w-0 items-center gap-3 text-right">
        <div className="min-w-0">
          <dt className="text-xs font-medium uppercase tracking-wide text-ink/45">Check-out</dt>
          <dd className="mt-0.5 truncate font-display text-lg text-pine">{checkOut}</dd>
          {checkOutDetail ? <dd className="truncate text-xs text-ink/55">{checkOutDetail}</dd> : null}
        </div>
        <span className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sage/60 text-pine sm:flex"><LogOut className="h-5 w-5" aria-hidden /></span>
      </div>
    </div>
  );
}

/**
 * The balance, loud: solid clay while money is owed (and a shortcut to record
 * it), solid green once paid. Muted for cancelled or expired stays.
 */
function BalanceCard({ balanceCents, paidShare, href, muted }: { balanceCents: number; paidShare: number; href?: string; muted: boolean }) {
  const due = balanceCents > 0;
  const overpaid = balanceCents < 0;
  const body = (
    <>
      <span className={cn("hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl sm:flex", muted ? "bg-pine/10 text-pine" : "bg-white/20 text-white")}>
        {due ? <Wallet className="h-5 w-5" aria-hidden /> : <Check className="h-5 w-5" aria-hidden />}
      </span>
      <div className="min-w-0 flex-1">
        <dt className={cn("text-xs font-semibold uppercase tracking-wide", muted ? "text-ink/45" : "text-white/80")}>{overpaid ? "Overpaid" : due ? "Balance due" : "Balance"}</dt>
        <dd className="mt-0.5 truncate font-display text-2xl leading-tight @3xl:text-3xl">{due || overpaid ? formatPHP(Math.abs(balanceCents)) : "Paid in full"}</dd>
        <dd className={cn("truncate text-xs", muted ? "text-ink/55" : "text-white/80")}>
          {due ? `${Math.round(paidShare * 100)}% paid` : overpaid ? "Refund the difference" : "Nothing left to collect"}
        </dd>
      </div>
      {href ? <ArrowRight className="h-5 w-5 shrink-0 text-white/80" aria-hidden /> : null}
    </>
  );
  const className = cn(
    "col-span-2 flex min-w-0 items-center gap-3 rounded-xl p-3 sm:p-4 @3xl:col-span-1 @3xl:col-start-3 @3xl:row-span-2 @3xl:row-start-1 @3xl:p-5",
    muted ? "bg-linen text-pine" : due ? "bg-clay text-white shadow-[0_6px_18px_rgba(166,78,55,0.3)]" : overpaid ? "bg-amber-500 text-white" : "bg-pine text-white",
  );
  if (!href) return <div className={className}>{body}</div>;
  // A stretched link keeps the <dl> valid while making the whole card open the payment modal.
  return (
    <div className={cn(className, "relative transition-colors hover:bg-clay-deep has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-clay has-[a:focus-visible]:ring-offset-2")}>
      {body}
      <Link href={href} className="absolute inset-0 rounded-xl focus-visible:outline-none" aria-label="Record payment" />
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: typeof LogIn;
  label: string;
  value: string;
  detail?: string;
  tone?: "clay" | "sage";
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-2.5 rounded-xl border p-3 sm:gap-3 sm:p-4",
        tone === "clay"
          ? "border-clay/25 bg-clay-mist/50"
          : tone === "sage"
            ? "border-sage-deep/30 bg-sage/35"
            : "border-transparent bg-linen",
      )}
    >
      <span
        className={cn(
          "hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl sm:flex",
          tone === "clay"
            ? "bg-clay text-white"
            : tone === "sage"
              ? "bg-pine text-white"
              : "bg-sage/60 text-pine",
        )}
      >
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <div className="min-w-0">
        <dt className="text-xs font-medium uppercase tracking-wide text-ink/45">
          {label}
        </dt>
        <dd className="mt-0.5 truncate font-display text-lg text-pine">
          {value}
        </dd>
        {detail ? (
          <dd className="truncate text-xs text-ink/55">{detail}</dd>
        ) : null}
      </div>
    </div>
  );
}
