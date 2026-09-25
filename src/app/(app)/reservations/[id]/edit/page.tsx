import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/auth/session";
import { PermissionDenied } from "@/components/app/permission-denied";
import { PageHeading } from "@/components/app/page-heading";
import { getReservationDetail, ReservationError } from "@/server/reservations/service";
import { listGuests } from "@/server/reservations/service";
import { listOrgUnits, listProperties } from "@/server/inventory/service";
import { getReservationLedger } from "@/server/payments/service";
import { ReservationForm } from "../../new/reservation-form";
import { toUnitOption } from "../../new/unit-options";
import { todayInTimeZone } from "@/lib/dates";

export const metadata: Metadata = { title: "Edit reservation" };

export default async function EditReservationPage({ params }: { params: Promise<{ id: string }> }) {
  const membership = await requireOwner();
  if (!membership) return <PermissionDenied />;
  const { id } = await params;
  let detail;
  try { detail = await getReservationDetail(membership.organizationId, id); } catch (error) { if (error instanceof ReservationError) notFound(); throw error; }
  const backHref = `/reservations/${id}`;
  if (detail.reservation.status !== "hold" && detail.reservation.status !== "confirmed") {
    return <div className="mx-auto max-w-2xl"><PageHeading title="Edit reservation" backHref={backHref} backLabel="Back to reservation" /><p className="text-sm text-ink/60">Only a hold or confirmed reservation can be edited.</p></div>;
  }

  const [guests, units, properties, ledger] = await Promise.all([
    listGuests(membership.organizationId),
    listOrgUnits(membership.organizationId),
    listProperties(membership.organizationId),
    getReservationLedger(membership.organizationId, id),
  ]);
  const propertyById = new Map(properties.map((property) => [property.id, property]));
  const { reservation, guest, unit } = detail;

  return (
    <div className="min-w-0 overflow-hidden">
      <PageHeading
        title="Edit reservation"
        description={`${guest.name} · #${reservation.id.slice(0, 8).toUpperCase()}. Payment history stays as an immutable ledger.`}
        backHref={backHref}
        backLabel="Back to reservation"
      />
      <ReservationForm
        isOwner
        // The current unit stays selectable even if it is no longer active.
        units={units.filter((candidate) => candidate.status === "active" || candidate.id === unit.id).map((candidate) => toUnitOption(candidate, propertyById.get(candidate.propertyId), { multipleProperties: properties.length > 1, isOwner: true }))}
        guests={guests.map((option) => ({ id: option.id, name: option.name, email: option.email, phone: option.phone }))}
        defaultCheckIn={reservation.checkInDate}
        defaultCheckOut={reservation.checkOutDate}
        requestedUnitId={unit.id}
        defaultGuestCount={reservation.guestCount}
        today={todayInTimeZone(propertyById.get(unit.propertyId)?.timezone ?? "Asia/Manila")}
        edit={{
          reservationId: reservation.id,
          guestId: guest.id,
          occupants: (detail.occupants ?? []).map((occupant) => occupant.name),
          charges: detail.charges.map((charge) => ({ type: charge.type, description: charge.description, quantity: charge.quantity, unitAmountCents: charge.unitAmountCents })),
          paid: { bookingCents: ledger.balances.paidBookingCents - ledger.balances.refundedBookingCents, depositCents: ledger.balances.depositHeldCents },
        }}
      />
    </div>
  );
}
