"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Filter } from "lucide-react";
import { Button, buttonClassName } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { useAnchoredPopover } from "@/components/ui/use-anchored-popover";

type ReservationFiltersProps = {
  query?: string;
  status?: string;
  unitId?: string;
  platformId?: string;
  startDate?: string;
  endDate?: string;
  sort: "checkin" | "booked";
  units: Array<{ id: string; name: string }>;
  platforms: Array<{ id: string; name: string; isActive: boolean }>;
};

export function ReservationFilters({
  query,
  status,
  unitId,
  platformId,
  startDate,
  endDate,
  sort,
  units,
  platforms,
}: ReservationFiltersProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  useAnchoredPopover({
    open,
    onClose: () => setOpen(false),
    wrapperRef,
    triggerRef,
    popoverRef,
    align: "end",
  });

  const activeCount = Number(Boolean(unitId)) + Number(Boolean(platformId)) + Number(Boolean(startDate)) + Number(Boolean(endDate)) + Number(sort === "booked");

  return (
    <div ref={wrapperRef} className="relative ml-auto flex items-center gap-2">
      {activeCount ? (
        <Link href={query || status ? `/reservations?${new URLSearchParams({ ...(query ? { q: query } : {}), ...(status ? { status } : {}) })}` : "/reservations"} className="hidden text-sm text-pine/70 underline-offset-4 hover:text-pine hover:underline sm:inline">
          Reset filters
        </Link>
      ) : null}
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls="reservation-filters"
        onClick={() => setOpen((current) => !current)}
        className={buttonClassName("outline", "md")}
      >
        <Filter className="h-4 w-4" aria-hidden />
        Filters
        {activeCount ? (
          <span className="rounded-full bg-pine px-1.5 py-0.5 text-xs leading-none text-white">
            {activeCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          ref={popoverRef}
          id="reservation-filters"
          popover="manual"
          role="dialog"
          aria-label="Reservation filters"
          className="fixed inset-auto m-0 w-[calc(100vw-2rem)] max-w-md rounded-2xl border border-pine/15 bg-surface p-4 text-ink shadow-xl"
        >
          <form method="get" className="space-y-4">
            {query ? <input type="hidden" name="q" value={query} /> : null}
            {status ? <input type="hidden" name="status" value={status} /> : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="reservation-filter-unit" className="mb-1.5 block text-sm font-medium text-ink">Unit</label>
                <Select id="reservation-filter-unit" name="unit" defaultValue={unitId ?? ""}>
                  <option value="">All units</option>
                  {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
                </Select>
              </div>
              <div>
                <label htmlFor="reservation-filter-platform" className="mb-1.5 block text-sm font-medium text-ink">Booked through</label>
                <Select id="reservation-filter-platform" name="platform" defaultValue={platformId ?? ""}>
                  <option value="">All platforms</option>
                  {platforms.map((platform) => <option key={platform.id} value={platform.id}>{platform.name}{platform.isActive ? "" : " (retired)"}</option>)}
                </Select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="reservation-filter-start" className="mb-1.5 block text-sm font-medium text-ink">Start date</label>
                <Input id="reservation-filter-start" name="start" type="date" defaultValue={startDate ?? ""} />
              </div>
              <div>
                <label htmlFor="reservation-filter-end" className="mb-1.5 block text-sm font-medium text-ink">End date</label>
                <Input id="reservation-filter-end" name="end" type="date" defaultValue={endDate ?? ""} min={startDate} />
              </div>
            </div>
            <div>
              <label htmlFor="reservation-filter-sort" className="mb-1.5 block text-sm font-medium text-ink">Sort by</label>
              <Select id="reservation-filter-sort" name="sort" defaultValue={sort}>
                <option value="checkin">Check-in date</option>
                <option value="booked">Date booked</option>
              </Select>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-pine/10 pt-4">
              <Link href="/reservations" className={buttonClassName("ghost", "md")}>Clear</Link>
              <Button type="submit" variant="primary" size="md">Apply filters</Button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
