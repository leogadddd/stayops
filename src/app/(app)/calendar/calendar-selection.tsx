"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { addDaysLocal } from "@/lib/dates";

function reservationHref(checkIn: string, checkOut: string, unitId?: string) {
  const query = new URLSearchParams({ checkIn, checkOut });
  if (unitId) query.set("unit", unitId);
  return `/reservations/new?${query}`;
}

export function CalendarSelection({ days, unitId }: { days: string[]; unitId?: string }) {
  const router = useRouter();
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);

  useEffect(() => {
    function finishSelection() {
      if (!startDate) return;
      const first = startDate < (endDate ?? startDate) ? startDate : endDate ?? startDate;
      const last = startDate > (endDate ?? startDate) ? startDate : endDate ?? startDate;
      router.push(reservationHref(first, addDaysLocal(last, 1), unitId));
      setStartDate(null);
      setEndDate(null);
    }

    window.addEventListener("pointerup", finishSelection);
    return () => window.removeEventListener("pointerup", finishSelection);
  }, [endDate, router, startDate, unitId]);

  const first = startDate && endDate ? (startDate < endDate ? startDate : endDate) : startDate;
  const last = startDate && endDate ? (startDate > endDate ? startDate : endDate) : endDate;

  return (
    <div className="pointer-events-none absolute inset-0 z-0 grid" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }} aria-hidden="true">
      {days.map((day) => {
        const selected = first && last && day >= first && day <= last;
        return (
          <button
            key={day}
            type="button"
            tabIndex={-1}
            className={`pointer-events-auto touch-none border-0 outline-none transition-colors ${selected ? "bg-clay/10" : "hover:bg-sage/25"}`}
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              event.preventDefault();
              setStartDate(day);
              setEndDate(day);
            }}
            onPointerEnter={(event) => {
              if (event.buttons === 1 && startDate) setEndDate(day);
            }}
          />
        );
      })}
    </div>
  );
}
