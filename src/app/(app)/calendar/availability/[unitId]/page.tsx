import { photoSrc } from "@/lib/photos";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Bath, BedDouble, CalendarDays, CircleAlert, CircleCheck, MapPin, Users } from "lucide-react";
import { z } from "zod";
import { buttonClassName } from "@/components/ui/button";
import { requireMembership } from "@/lib/auth/session";
import { UNIT_STATUS_LABELS } from "@/lib/labels";
import { addDaysLocal, todayInTimeZone } from "@/lib/dates";
import { formatPHP } from "@/lib/money";
import { cn } from "@/lib/utils";
import { listPropertyAmenities, listUnitAmenities } from "@/server/inventory/amenities";
import { buildNightStatusMap, getOccupancySegments } from "@/server/inventory/availability";
import { getPropertyOrThrow, getUnitOrThrow } from "@/server/inventory/service";
import { findFreeUnitIds, parseStaySearch, staySearchQuery, type StaySearchParams } from "@/server/inventory/stay-search";
import { InventoryError } from "@/server/inventory/validation";
import { dayLabel, plural, UnitPhoto } from "../stay-display";
import { AmenityPanel, DetailsPanel, findNeighbors, houseRuleLines, plannerDays, RulesPanel } from "./stay-details";
import { InfoTabs, StayPlanner } from "./stay-planner";

export const metadata: Metadata = { title: "Stay details" };

/** How far either side of the stay to look for the previous and next booking. */
const LOOKAROUND_DAYS = 30;

/** Widens [from, to) to whole Sunday–Saturday weeks. */
function wholeWeeks(from: string, to: string) {
  const weekday = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();
  return { start: addDaysLocal(from, -weekday(from)), end: addDaysLocal(to, 7 - weekday(to)) };
}

type StayStatus = "available" | "occupied" | "too-small" | "not-bookable";

export default async function StayShowcasePage({ params, searchParams }: {
  params: Promise<{ unitId: string }>;
  searchParams: Promise<StaySearchParams>;
}) {
  const membership = await requireMembership();
  const [{ unitId }, query] = await Promise.all([params, searchParams]);
  if (!z.uuid().safeParse(unitId).success) notFound();

  let unit, property;
  try {
    unit = await getUnitOrThrow(membership.organizationId, unitId);
    property = await getPropertyOrThrow(membership.organizationId, unit.propertyId);
  } catch (error) {
    if (error instanceof InventoryError) notFound();
    throw error;
  }
  const { search } = parseStaySearch(query);
  const today = todayInTimeZone(property.timezone);
  // Nights loaded for the planner: whole weeks, LOOKAROUND_DAYS either side of the stay (or of today).
  const lookaround = wholeWeeks(addDaysLocal(search?.checkIn ?? today, -LOOKAROUND_DAYS), addDaysLocal(search?.checkOut ?? today, LOOKAROUND_DAYS));
  const [unitAmenities, propertyAmenities, segmentsByUnit, freeIds] = await Promise.all([
    listUnitAmenities(membership.organizationId, unit.id),
    listPropertyAmenities(membership.organizationId, property.id),
    getOccupancySegments(membership.organizationId, [unit.id], lookaround.start, lookaround.end),
    search && unit.status === "active" && unit.capacity >= search.guestCount
      ? findFreeUnitIds(membership.organizationId, [unit], new Map([[property.id, property.timezone]]), search)
      : null,
  ]);

  const status: StayStatus | null = !search ? null
    : unit.status !== "active" ? "not-bookable"
      : unit.capacity < search.guestCount ? "too-small"
        : freeIds?.has(unit.id) ? "available" : "occupied";
  const searchQuery = search ? staySearchQuery(search) : null;
  const resultsHref = searchQuery ? `/calendar/availability?${searchQuery}` : "/calendar/availability";
  const bookHref = `/reservations/new?${new URLSearchParams({ unit: unit.id, ...(search ? { checkIn: search.checkIn, checkOut: search.checkOut, guests: String(search.guestCount) } : {}) })}`;
  const calendarHref = `/calendar?${new URLSearchParams({ unit: unit.id, ...(search ? { month: search.checkIn.slice(0, 7) } : {}) })}`;
  const showRates = membership.role === "owner";
  const photos = [...new Set([photoSrc("unit", unit), photoSrc("property", property)].filter((src): src is string => Boolean(src)))];
  const stayCents = search ? unit.defaultNightlyRateCents * search.nights : 0;
  const totalCents = stayCents + (unit.cleaningFeeCents ?? 0);
  const segments = segmentsByUnit.get(unit.id) ?? [];
  const segmentHref = (segment: { kind: "reservation" | "block"; id: string }) => segment.kind === "reservation"
    ? `/reservations/${segment.id}`
    : membership.role === "owner" ? `/properties/${property.id}/units/${unit.id}` : undefined;
  const neighbors = search ? findNeighbors(segments, search.checkIn, search.checkOut, segmentHref) : { previous: null, next: null };
  const rules = houseRuleLines(property.houseRules);
  const amenityCount = unitAmenities.length + propertyAmenities.length;

  return (
    <div className="min-w-0 overflow-hidden">
      <Link href={resultsHref} className="mb-4 inline-flex items-center gap-2 text-sm text-pine/70 hover:text-clay"><ArrowLeft className="h-4 w-4" aria-hidden />{search ? "Back to results" : "Back to search"}</Link>

      {/* On phones the booking summary sits right under the title; on desktop it is a sticky side column. */}
      <div className="grid min-w-0 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] 2xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="order-1 min-w-0 space-y-8 lg:order-none lg:col-start-1 lg:row-start-1">
          {photos.length > 1 ? (
            <div className="grid gap-2 sm:grid-cols-[2fr_1fr]">
              <UnitPhoto src={photos[0]!} className="aspect-[16/10] rounded-2xl sm:aspect-auto sm:h-full sm:min-h-80" />
              <UnitPhoto src={photos[1]!} className="hidden rounded-2xl sm:block sm:aspect-[4/5]" />
            </div>
          ) : (
            <UnitPhoto src={photos[0] ?? null} className={cn("w-full rounded-2xl", photos.length ? "aspect-[16/9] max-h-[32rem]" : "h-48 sm:h-64")} />
          )}

          <header>
            <p className="text-xs font-medium uppercase tracking-wide text-clay-deep">{property.name}</p>
            <h1 className="mt-1 font-display text-3xl tracking-tight text-pine sm:text-4xl">{unit.name}</h1>
            {property.address ? <p className="mt-2 flex items-center gap-1.5 text-sm text-ink/60"><MapPin className="h-4 w-4 shrink-0" aria-hidden />{property.address}</p> : null}
            <ul className="mt-5 flex flex-wrap gap-2">
              <Fact icon={Users}>Sleeps {unit.capacity}</Fact>
              <Fact icon={BedDouble}>{unit.bedrooms ? plural(unit.bedrooms, "bedroom") : "Studio"}</Fact>
              <Fact icon={Bath}>{unit.bathrooms} bath{unit.bathrooms === 1 ? "" : "s"}</Fact>
            </ul>
          </header>
        </div>

        <div className="order-3 min-w-0 space-y-6 lg:order-none lg:col-start-1 lg:row-start-2">
          <StayPlanner
            unitId={unit.id}
            search={search ? { checkIn: search.checkIn, checkOut: search.checkOut, nights: search.nights } : null}
            guestCount={search?.guestCount ?? Math.min(2, unit.capacity)}
            today={today}
            days={plannerDays(buildNightStatusMap(lookaround.start, lookaround.end, segments), segmentHref)}
            previous={neighbors.previous}
            next={neighbors.next}
            checkInTime={unit.checkInTime}
            checkOutTime={unit.checkOutTime}
            turnoverMinutes={property.turnoverDurationMinutes}
          />
          <InfoTabs tabs={[
            { id: "amenities", label: "Amenities", count: amenityCount, content: <AmenityPanel groups={[{ title: "In the unit", amenities: unitAmenities }, { title: `At ${property.name}`, amenities: propertyAmenities }]} /> },
            { id: "details", label: "Details", content: <DetailsPanel checkInTime={unit.checkInTime} checkOutTime={unit.checkOutTime} turnoverMinutes={property.turnoverDurationMinutes} timezone={property.timezone} address={property.address} rates={showRates ? { nightlyRateCents: unit.defaultNightlyRateCents, cleaningFeeCents: unit.cleaningFeeCents, securityDepositCents: unit.securityDepositCents } : null} /> },
            { id: "rules", label: "House rules", count: rules.length, content: <RulesPanel lines={rules} /> },
          ]} />
        </div>

        <aside className="order-2 min-w-0 lg:order-none lg:sticky lg:top-0 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <div className="rounded-2xl border border-pine/10 bg-white p-5 shadow-[0_1px_2px_rgba(32,58,53,0.06)]">
            {search ? (
              <>
                <StatusBanner status={status!} guestCount={search.guestCount} unitStatus={UNIT_STATUS_LABELS[unit.status]} capacity={unit.capacity} />
                <dl className="mt-4 grid grid-cols-2 overflow-hidden rounded-xl border border-pine/15 text-sm">
                  <div className="border-b border-r border-pine/15 p-3"><dt className="text-xs font-medium uppercase tracking-wide text-ink/45">Check-in</dt><dd className="mt-0.5 font-medium text-pine">{dayLabel(search.checkIn)}</dd></div>
                  <div className="border-b border-pine/15 p-3"><dt className="text-xs font-medium uppercase tracking-wide text-ink/45">Check-out</dt><dd className="mt-0.5 font-medium text-pine">{dayLabel(search.checkOut)}</dd></div>
                  <div className="border-r border-pine/15 p-3"><dt className="text-xs font-medium uppercase tracking-wide text-ink/45">Guests</dt><dd className="mt-0.5 font-medium text-pine">{search.guestCount}</dd></div>
                  <div className="p-3"><dt className="text-xs font-medium uppercase tracking-wide text-ink/45">Nights</dt><dd className="mt-0.5 font-medium text-pine">{search.nights}</dd></div>
                </dl>
                {showRates && unit.defaultNightlyRateCents ? (
                  <dl className="mt-4 space-y-2 text-sm">
                    <div className="flex justify-between gap-3 text-ink/70"><dt>{formatPHP(unit.defaultNightlyRateCents)} × {plural(search.nights, "night")}</dt><dd>{formatPHP(stayCents)}</dd></div>
                    {unit.cleaningFeeCents ? <div className="flex justify-between gap-3 text-ink/70"><dt>Cleaning fee</dt><dd>{formatPHP(unit.cleaningFeeCents)}</dd></div> : null}
                    <div className="flex justify-between gap-3 border-t border-pine/10 pt-2 font-medium text-pine"><dt>Estimated total</dt><dd className="font-display text-lg">{formatPHP(totalCents)}</dd></div>
                    {unit.securityDepositCents ? <p className="text-xs text-ink/50">Plus a {formatPHP(unit.securityDepositCents)} refundable security deposit.</p> : null}
                  </dl>
                ) : null}
                <div className="mt-5 grid gap-2">
                  {status === "available" ? <Link href={bookHref} className={buttonClassName("clay", "lg", "rounded-xl")}>Book this stay<ArrowRight className="h-4 w-4" aria-hidden /></Link> : <Link href={resultsHref} className={buttonClassName("clay", "lg", "rounded-xl")}>See other stays</Link>}
                  <Link href={calendarHref} className={buttonClassName("outline", "md", "rounded-xl")}><CalendarDays className="h-4 w-4" aria-hidden />Open in calendar</Link>
                </div>
                <p className="mt-3 text-center text-xs text-ink/50">Saving the reservation runs the final conflict check.</p>
              </>
            ) : (
              <>
                <p className="font-display text-lg text-pine">Check dates for this unit</p>
                <p className="mt-1 text-sm text-ink/60">Search stay dates and a guest count to see if {unit.name} is free.</p>
                {showRates && unit.defaultNightlyRateCents ? <p className="mt-4 text-sm text-ink/60"><span className="font-display text-xl text-pine">{formatPHP(unit.defaultNightlyRateCents)}</span> / night</p> : null}
                <div className="mt-5 grid gap-2">
                  <Link href="/calendar/availability" className={buttonClassName("clay", "lg", "rounded-xl")}>Search dates</Link>
                  <Link href={calendarHref} className={buttonClassName("outline", "md", "rounded-xl")}><CalendarDays className="h-4 w-4" aria-hidden />Open in calendar</Link>
                </div>
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function Fact({ icon: Icon, children }: { icon: typeof Users; children: React.ReactNode }) {
  return <li className="inline-flex items-center gap-1.5 rounded-full border border-pine/15 bg-white px-3 py-1.5 text-sm text-pine"><Icon className="h-4 w-4 text-pine/55" aria-hidden />{children}</li>;
}

function StatusBanner({ status, guestCount, capacity, unitStatus }: { status: StayStatus; guestCount: number; capacity: number; unitStatus: string }) {
  const available = status === "available";
  const message = {
    available: "Available for these dates",
    occupied: "Booked, held, or blocked for part of these dates",
    "too-small": `Sleeps ${capacity}, not enough for ${plural(guestCount, "guest")}`,
    "not-bookable": `Not bookable while ${unitStatus.toLowerCase()}`,
  }[status];
  const Icon = available ? CircleCheck : CircleAlert;
  return (
    <p role="status" className={cn("flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm font-medium", available ? "bg-sage/50 text-pine-deep" : "bg-clay-mist text-clay-deep")}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />{message}
    </p>
  );
}
