import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/auth/session";
import { PermissionDenied } from "@/components/app/permission-denied";
import { PageHeading } from "@/components/app/page-heading";
import { getReservationDetail, ReservationError } from "@/server/reservations/service";
import { listGuests } from "@/server/reservations/service";
import { listOrgUnits, listProperties } from "@/server/inventory/service";
import { EditReservationForm } from "../edit-reservation-form";

export const metadata: Metadata = { title: "Edit reservation" };
export default async function EditReservationPage({ params }: { params: Promise<{ id: string }> }) {
  const membership = await requireOwner();
  if (!membership) return <PermissionDenied />;
  const { id } = await params;
  let detail;
  try { detail = await getReservationDetail(membership.organizationId, id); } catch (error) { if (error instanceof ReservationError) notFound(); throw error; }
  if (detail.reservation.status !== "hold" && detail.reservation.status !== "confirmed") return <div className="mx-auto max-w-2xl"><PageHeading title="Edit reservation" backHref={`/reservations/${id}`} backLabel="Back to reservation" /><p className="text-sm text-ink/60">Only a hold or confirmed reservation can be edited.</p></div>;
  const [guests, units, properties] = await Promise.all([listGuests(membership.organizationId), listOrgUnits(membership.organizationId), listProperties(membership.organizationId)]);
  const label = (unit: (typeof units)[number]) => properties.length > 1 ? `${properties.find((property) => property.id === unit.propertyId)?.name ?? "Property"} · ${unit.name}` : unit.name;
  return <div className="mx-auto max-w-3xl"><PageHeading title="Edit reservation" description="Update booking details. Payment history stays as an immutable ledger." backHref={`/reservations/${id}`} backLabel="Back to reservation" /><EditReservationForm reservationId={id} unitId={detail.unit.id} capacity={detail.unit.capacity} checkIn={detail.reservation.checkInDate} checkOut={detail.reservation.checkOutDate} guestCount={detail.reservation.guestCount} occupants={detail.occupants.map((occupant) => occupant.name)} guestId={detail.guest.id} guests={guests.map((guest) => ({ id: guest.id, name: guest.name, email: guest.email, phone: guest.phone }))} units={units.filter((unit) => unit.status === "active" || unit.id === detail.unit.id).map((unit) => ({ id: unit.id, label: label(unit), capacity: unit.capacity }))} charges={detail.charges} /></div>;
}
