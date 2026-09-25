import type { Metadata } from "next";
import Link from "next/link";
import { Bath, BedDouble, CalendarSearch, ChevronRight, Users } from "lucide-react";
import { PageHeading } from "@/components/app/page-heading";
import { buttonClassName } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { requireMembership } from "@/lib/auth/session";
import { todayInTimeZone } from "@/lib/dates";
import { formatPHP } from "@/lib/money";
import { listOrgUnits, listProperties } from "@/server/inventory/service";
import { findFreeUnitIds, parseStaySearch, staySearchQuery, type StaySearch, type StaySearchParams } from "@/server/inventory/stay-search";
import { AvailabilityCheckForm } from "../availability-check-form";
import { dayLabel, plural, UnitPhoto } from "./stay-display";

export const metadata: Metadata = { title: "Check availability" };

interface ResultCard {
  id: string;
  name: string;
  propertyName: string | null;
  imageUrl: string | null;
  capacity: number;
  bedrooms: number;
  bathrooms: number;
  nightlyRateCents: number;
  estimatedTotalCents: number;
}

export default async function AvailabilityPage({ searchParams }: { searchParams: Promise<StaySearchParams> }) {
  const membership = await requireMembership();
  const params = await searchParams;
  const [properties, units] = await Promise.all([
    listProperties(membership.organizationId),
    listOrgUnits(membership.organizationId),
  ]);
  // Quick date picks start from the first property's local today, like the calendar.
  const today = todayInTimeZone(properties[0]?.timezone ?? "Asia/Manila");
  const { search, error } = parseStaySearch(params);
  const showRates = membership.role === "owner";

  const activeUnits = units.filter((unit) => unit.status === "active");
  let results: { cards: ResultCard[]; tooSmallCount: number; occupiedCount: number } | null = null;
  if (search) {
    const candidates = activeUnits.filter((unit) => unit.capacity >= search.guestCount);
    const propertyById = new Map(properties.map((property) => [property.id, property]));
    const freeIds = await findFreeUnitIds(membership.organizationId, candidates, new Map(properties.map((property) => [property.id, property.timezone])), search);
    const cards = candidates.filter((unit) => freeIds.has(unit.id)).map((unit) => {
      const property = propertyById.get(unit.propertyId);
      return {
        id: unit.id,
        name: unit.name,
        propertyName: property?.name ?? null,
        imageUrl: unit.imageUrl ?? property?.imageUrl ?? null,
        capacity: unit.capacity,
        bedrooms: unit.bedrooms,
        bathrooms: unit.bathrooms,
        nightlyRateCents: unit.defaultNightlyRateCents,
        estimatedTotalCents: unit.defaultNightlyRateCents * search.nights + (unit.cleaningFeeCents ?? 0),
      };
    });
    // Closest fit first, so a couple isn't offered the six-bed villa before the studio.
    cards.sort((a, b) => a.capacity - b.capacity || a.nightlyRateCents - b.nightlyRateCents || a.name.localeCompare(b.name));
    results = { cards, tooSmallCount: activeUnits.length - candidates.length, occupiedCount: candidates.length - cards.length };
  }

  return (
    <div className="min-w-0 overflow-hidden">
      <PageHeading title="Check availability" description="Search active units by stay dates and guest count. Saving a reservation performs the final conflict check." backHref="/calendar" backLabel="Back to calendar" />
      {units.length ? (
        <AvailabilityCheckForm
          // Remount on back/forward so the fields match the URL again.
          key={search ? staySearchQuery(search).toString() : "idle"}
          today={today}
          defaults={{ checkIn: search?.checkIn ?? "", checkOut: search?.checkOut ?? "", guestCount: search?.guestCount ?? 2 }}
          error={error}
        >
          {search && results ? <Results search={search} showRates={showRates} {...results} /> : <IdleState activeUnitCount={activeUnits.length} />}
        </AvailabilityCheckForm>
      ) : (
        <EmptyState
          title="No units to check"
          description={membership.role === "owner" ? "Add a property and unit before checking stay dates." : "Ask the owner to add a property and unit."}
          action={membership.role === "owner" ? <Link href="/settings/properties" className={buttonClassName("clay", "md")}>Manage properties</Link> : undefined}
        />
      )}
    </div>
  );
}

function Results({ search, cards, tooSmallCount, occupiedCount, showRates }: {
  search: StaySearch;
  cards: ResultCard[];
  tooSmallCount: number;
  occupiedCount: number;
  showRates: boolean;
}) {
  const query = staySearchQuery(search).toString();
  const excluded = [
    occupiedCount ? `${occupiedCount} booked or blocked` : null,
    tooSmallCount ? `${tooSmallCount} too small` : null,
  ].filter(Boolean);
  return (
    <section aria-live="polite" className="min-w-0">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          <h2 className="font-display text-2xl text-pine">{cards.length ? `${plural(cards.length, "stay")} available` : "No stays available"}</h2>
          <p className="mt-1 text-sm text-ink/60">{dayLabel(search.checkIn)} → {dayLabel(search.checkOut)} · {plural(search.nights, "night")} · {plural(search.guestCount, "guest")}</p>
        </div>
        {excluded.length ? <p className="text-sm text-ink/50">Not shown: {excluded.join(" · ")}</p> : null}
      </div>
      {cards.length ? (
        <ul className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {cards.map((card) => (
            <li key={card.id} className="min-w-0">
              <Link href={`/calendar/availability/${card.id}?${query}`} className="group flex h-full min-h-40 overflow-hidden rounded-2xl border border-pine/10 bg-white shadow-[0_1px_2px_rgba(32,58,53,0.06)] transition-shadow hover:border-pine/20 hover:shadow-[0_8px_24px_rgba(32,58,53,0.10)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage">
                <UnitPhoto src={card.imageUrl} className="w-2/5 max-w-56 shrink-0" imageClassName="transition-transform duration-500 group-hover:scale-[1.04]" />
                <div className="flex min-w-0 flex-1 flex-col p-4">
                  {card.propertyName ? <p className="truncate text-xs font-medium uppercase tracking-wide text-clay-deep">{card.propertyName}</p> : null}
                  <h3 className="mt-0.5 truncate font-display text-lg text-pine">{card.name}</h3>
                  <ul className="mt-2 flex flex-wrap gap-x-3.5 gap-y-1 text-sm text-ink/70">
                    <li className="flex items-center gap-1" title={`Sleeps ${card.capacity}`}><Users className="h-4 w-4 text-pine/50" aria-hidden /><span className="sr-only">Sleeps </span>{card.capacity}</li>
                    <li className="flex items-center gap-1" title={card.bedrooms ? plural(card.bedrooms, "bedroom") : "Studio"}><BedDouble className="h-4 w-4 text-pine/50" aria-hidden />{card.bedrooms ? <><span className="sr-only">Bedrooms </span>{card.bedrooms}</> : "Studio"}</li>
                    <li className="flex items-center gap-1" title={`${card.bathrooms} bath${card.bathrooms === 1 ? "" : "s"}`}><Bath className="h-4 w-4 text-pine/50" aria-hidden /><span className="sr-only">Baths </span>{card.bathrooms}</li>
                  </ul>
                  <div className="mt-auto flex items-end justify-between gap-2 pt-3">
                    {showRates ? (
                      card.nightlyRateCents ? (
                        <div className="min-w-0">
                          <p className="text-sm text-ink/60"><span className="font-display text-lg text-pine">{formatPHP(card.nightlyRateCents)}</span> / night</p>
                          <p className="truncate text-xs text-ink/50">{formatPHP(card.estimatedTotalCents)} total</p>
                        </div>
                      ) : <p className="text-sm text-ink/50">No rate set</p>
                    ) : <span />}
                    <ChevronRight className="h-5 w-5 shrink-0 text-pine/35 transition-transform group-hover:translate-x-0.5 group-hover:text-clay" aria-hidden />
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-2xl border border-dashed border-pine/20 bg-linen/60 px-6 py-12 text-center">
          <CalendarSearch className="mx-auto h-8 w-8 text-pine/40" aria-hidden />
          <p className="mt-3 font-medium text-pine">Nothing open for these dates</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-ink/60">Try shifting the dates or lowering the guest count. Inactive units, units that are too small, and units with an overlapping stay, hold, block, or turnover aren’t shown.</p>
        </div>
      )}
    </section>
  );
}

function IdleState({ activeUnitCount }: { activeUnitCount: number }) {
  return (
    <div className="rounded-2xl border border-dashed border-pine/20 bg-linen/60 px-6 py-16 text-center">
      <CalendarSearch className="mx-auto h-10 w-10 text-pine/40" aria-hidden />
      <p className="mt-4 font-display text-xl text-pine">Where can they stay?</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-ink/60">
        Pick dates and a guest count to search {activeUnitCount ? `your ${plural(activeUnitCount, "active unit")}` : "your units"}. We’ll leave out anything too small or already booked, held, blocked, or in turnover.
      </p>
    </div>
  );
}
