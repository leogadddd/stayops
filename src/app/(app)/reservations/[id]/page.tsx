import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireMembership } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { RESERVATION_STATUS_LABELS } from "@/lib/labels";
import { CHARGE_TYPE_LABELS, computeTotals } from "@/lib/charges";
import { formatPHP } from "@/lib/money";
import { listNights } from "@/lib/dates";
import {
  getReservationDetail,
  isLiveHold,
  ReservationError,
} from "@/server/reservations/service";
import { expireStaleHolds } from "@/server/reservations/holds";
import { getReservationLedger } from "@/server/payments/service";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmHoldForm } from "./confirm-hold-form";
import { CancelReservationForm } from "./cancel-reservation-form";
import { GuestLinkCard } from "./guest-link-card";
import { PaymentsCard } from "./payments-card";
import { RecordPaymentForm } from "./record-payment-form";
import { RecordRefundForm } from "./record-refund-form";
import { AddDeductionForm } from "./add-deduction-form";

export const metadata: Metadata = { title: "Reservation" };

const DATE_LABEL = new Intl.DateTimeFormat("en-PH", {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});
const TIME_LABEL = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
  timeStyle: "short",
});

const STATUS_TONE: Record<string, "sage" | "clay" | "neutral"> = {
  hold: "clay",
  confirmed: "sage",
  checked_in: "sage",
  checked_out: "neutral",
  cancelled: "neutral",
  expired: "neutral",
};

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

export default async function ReservationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const membership = await requireMembership();
  await expireStaleHolds(db, membership.organizationId);

  let detail;
  try {
    detail = await getReservationDetail(membership.organizationId, id);
  } catch (error) {
    if (error instanceof ReservationError) notFound();
    throw error;
  }

  const { reservation, guest, unit, property, charges, transitions, activeToken } =
    detail;
  const ledger = await getReservationLedger(membership.organizationId, id);
  const totals = computeTotals(charges);
  const nights = listNights(reservation.checkInDate, reservation.checkOutDate);
  const liveHold = isLiveHold(reservation.status, reservation.expiresAt);
  const moneyEditable =
    reservation.status !== "cancelled" && reservation.status !== "expired";

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/reservations"
        className="inline-flex items-center gap-1.5 text-sm text-pine/70 underline-offset-4 hover:text-pine hover:underline"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        All reservations
      </Link>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-pine">{guest.name}</h1>
          <p className="mt-1 text-sm text-ink/60">
            {unit.name}
            {property ? ` · ${property.name}` : ""} · {reservation.guestCount}{" "}
            {reservation.guestCount === 1 ? "guest" : "guests"}
          </p>
        </div>
        <Badge tone={STATUS_TONE[reservation.status] ?? "neutral"}>
          {RESERVATION_STATUS_LABELS[reservation.status]}
        </Badge>
      </div>

      {liveHold && reservation.expiresAt ? (
        <p className="mt-3 rounded-xl border border-clay/40 bg-clay-mist/60 px-4 py-3 text-sm text-clay-deep" role="status">
          This hold releases in {holdRemainingLabel(reservation.expiresAt)} (
          {TIME_LABEL.format(reservation.expiresAt)}). Confirm it before then to
          keep the dates.
        </p>
      ) : null}
      {reservation.status === "expired" ? (
        <p className="mt-3 rounded-xl border border-pine/15 bg-pine-mist/50 px-4 py-3 text-sm text-ink/70">
          This hold expired and the dates were released. Create a new hold or
          booking if the guest still wants the stay.
        </p>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <Card>
            <CardHeader>
              <h2 className="font-display text-lg text-pine">Stay</h2>
            </CardHeader>
            <CardBody>
              <dl className="grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-ink/45">
                    Check-in
                  </dt>
                  <dd className="mt-0.5 text-sm text-pine">
                    {DATE_LABEL.format(new Date(`${reservation.checkInDate}T00:00:00Z`))}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-ink/45">
                    Check-out
                  </dt>
                  <dd className="mt-0.5 text-sm text-pine">
                    {DATE_LABEL.format(new Date(`${reservation.checkOutDate}T00:00:00Z`))}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-ink/45">
                    Nights
                  </dt>
                  <dd className="mt-0.5 text-sm text-pine">
                    {nights.length} {nights.length === 1 ? "night" : "nights"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-ink/45">
                    Guest contact
                  </dt>
                  <dd className="mt-0.5 text-sm text-pine">
                    {guest.email ?? guest.phone ?? "—"}
                  </dd>
                </div>
              </dl>
              {guest.notes ? (
                <p className="mt-4 border-t border-pine/10 pt-3 text-sm text-ink/60">
                  {guest.notes}
                </p>
              ) : null}
              {reservation.confirmReason ? (
                <p className="mt-4 border-t border-pine/10 pt-3 text-sm text-ink/60">
                  <span className="font-medium text-ink">Confirmed because:</span>{" "}
                  {reservation.confirmReason}
                </p>
              ) : null}
              {reservation.cancelReason ? (
                <p className="mt-4 border-t border-pine/10 pt-3 text-sm text-ink/60">
                  <span className="font-medium text-ink">Cancelled because:</span>{" "}
                  {reservation.cancelReason}
                </p>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="font-display text-lg text-pine">Charges</h2>
            </CardHeader>
            <CardBody>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-medium uppercase tracking-wide text-ink/45">
                    <th className="pb-2 pr-3">Description</th>
                    <th className="pb-2 pr-3 text-right">Qty</th>
                    <th className="pb-2 pr-3 text-right">Unit price</th>
                    <th className="pb-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-pine/10">
                  {charges.map((charge) => (
                    <tr key={charge.id}>
                      <td className="py-2.5 pr-3">
                        <span className="text-pine">{charge.description}</span>
                        <span className="ml-1.5 text-xs text-ink/45">
                          {CHARGE_TYPE_LABELS[charge.type]}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-right text-ink/70">
                        {charge.quantity}
                      </td>
                      <td className="py-2.5 pr-3 text-right text-ink/70">
                        {formatPHP(charge.unitAmountCents)}
                      </td>
                      <td className="py-2.5 text-right font-medium text-pine">
                        {formatPHP(charge.amountCents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-pine/15 text-sm">
                    <td colSpan={3} className="pt-3 pr-3 text-ink/60">
                      Booking total (excl. deposit)
                    </td>
                    <td className="pt-3 text-right font-semibold text-pine">
                      {formatPHP(totals.bookingTotalCents)}
                    </td>
                  </tr>
                  <tr className="text-sm">
                    <td colSpan={3} className="pt-1.5 pr-3 text-ink/60">
                      Refundable deposit
                    </td>
                    <td className="pt-1.5 text-right font-medium text-pine">
                      {formatPHP(totals.depositTotalCents)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </CardBody>
          </Card>

          <PaymentsCard reservationId={reservation.id} ledger={ledger} />

          <Card>
            <CardHeader>
              <h2 className="font-display text-lg text-pine">Guest link</h2>
            </CardHeader>
            <CardBody>
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
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6 lg:col-span-2">
          {reservation.status === "hold" && liveHold ? (
            <Card>
              <CardHeader>
                <h2 className="font-display text-lg text-pine">Confirm hold</h2>
              </CardHeader>
              <CardBody>
                <ConfirmHoldForm reservationId={reservation.id} />
              </CardBody>
            </Card>
          ) : null}

          {reservation.status === "hold" || reservation.status === "confirmed" ? (
            <Card>
              <CardHeader>
                <h2 className="font-display text-lg text-clay-deep">
                  {reservation.status === "hold"
                    ? "Release the dates"
                    : "Cancel booking"}
                </h2>
              </CardHeader>
              <CardBody>
                <CancelReservationForm
                  reservationId={reservation.id}
                  label={
                    reservation.status === "hold"
                      ? "Cancel hold"
                      : "Cancel reservation"
                  }
                />
              </CardBody>
            </Card>
          ) : null}

          {moneyEditable ? (
            <>
              <Card>
                <CardHeader>
                  <h2 className="font-display text-lg text-pine">Record payment</h2>
                </CardHeader>
                <CardBody>
                  <RecordPaymentForm reservationId={reservation.id} />
                </CardBody>
              </Card>

              <Card>
                <CardHeader>
                  <h2 className="font-display text-lg text-pine">Record refund</h2>
                </CardHeader>
                <CardBody>
                  <RecordRefundForm reservationId={reservation.id} />
                </CardBody>
              </Card>

              {totals.depositTotalCents > 0 ? (
                <Card>
                  <CardHeader>
                    <h2 className="font-display text-lg text-pine">
                      Deposit deduction
                    </h2>
                  </CardHeader>
                  <CardBody>
                    <AddDeductionForm reservationId={reservation.id} />
                  </CardBody>
                </Card>
              ) : null}
            </>
          ) : null}

          <Card>
            <CardHeader>
              <h2 className="font-display text-lg text-pine">History</h2>
            </CardHeader>
            <CardBody>
              <ol className="space-y-4">
                {transitions.map((transition) => (
                  <li key={transition.id} className="relative pl-5">
                    <span className="absolute left-0 top-1.5 h-2 w-2 rounded-full bg-sage" aria-hidden />
                    <p className="text-sm text-pine">
                      {transition.fromStatus
                        ? `${RESERVATION_STATUS_LABELS[transition.fromStatus]} → `
                        : "Created as "}
                      {RESERVATION_STATUS_LABELS[transition.toStatus]}
                    </p>
                    {transition.note ? (
                      <p className="mt-0.5 text-xs text-ink/55">{transition.note}</p>
                    ) : null}
                    <p className="mt-0.5 text-xs text-ink/40">
                      {TIME_LABEL.format(transition.createdAt)}
                    </p>
                  </li>
                ))}
              </ol>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
