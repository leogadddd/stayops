import type { Metadata } from "next";
import { requireMembership } from "@/lib/auth/session";
import { addDaysLocal, isLocalDate, todayInTimeZone } from "@/lib/dates";
import {
  listOrgUnits,
  listProperties,
} from "@/server/inventory/service";
import { listGuests } from "@/server/reservations/service";
import { PageHeading } from "@/components/app/page-heading";
import { ReservationForm } from "./reservation-form";
import { toUnitOption } from "./unit-options";

export const metadata: Metadata = { title: "New reservation" };

export default async function NewReservationPage({
  searchParams,
}: {
  searchParams: Promise<{ unit?: string; checkIn?: string; checkOut?: string; guests?: string }>;
}) {
  const membership = await requireMembership();
  const params = await searchParams;

  const [units, properties, guestRows] = await Promise.all([
    listOrgUnits(membership.organizationId),
    listProperties(membership.organizationId),
    listGuests(membership.organizationId),
  ]);

  const timezone = properties[0]?.timezone ?? "Asia/Manila";
  const today = todayInTimeZone(timezone);
  const isOwner = membership.role === "owner";
  const propertyById = new Map(properties.map((property) => [property.id, property]));

  const activeUnits = units.filter((unit) => unit.status === "active");
  const defaultGuestCount = Math.min(50, Math.max(1, Math.trunc(Number(params.guests)) || 1));
  // Coming from an availability search: offer the way back to that stay.
  const fromSearch = params.unit && params.checkIn && params.checkOut && isLocalDate(params.checkIn) && isLocalDate(params.checkOut);
  const backHref = fromSearch
    ? `/calendar/availability/${params.unit}?${new URLSearchParams({ checkIn: params.checkIn!, checkOut: params.checkOut!, guests: String(defaultGuestCount) })}`
    : "/reservations";

  return (
    <div className="min-w-0 overflow-hidden">
      <PageHeading
        title="New reservation"
        backHref={backHref}
        backLabel={fromSearch ? "Back to stay details" : "All reservations"}
        description={`${isOwner ? "Place a time-limited hold or a confirmed booking." : "Place a time-limited hold for the owner to review."} Dates use each property's local timezone; the check-out day is free.`}
      />

      <ReservationForm
        isOwner={isOwner}
        units={activeUnits.map((unit) => toUnitOption(unit, propertyById.get(unit.propertyId), { multipleProperties: properties.length > 1, isOwner }))}
        guests={guestRows.map((guest) => ({ id: guest.id, name: guest.name, email: guest.email, phone: guest.phone }))}
        defaultCheckIn={params.checkIn ?? today}
        defaultCheckOut={params.checkOut ?? addDaysLocal(today, 1)}
        requestedUnitId={params.unit}
        defaultGuestCount={defaultGuestCount}
        today={today}
      />
    </div>
  );
}
