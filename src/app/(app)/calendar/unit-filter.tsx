import Link from "next/link";
import { BedDouble, Building2, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";

export interface UnitFilterOption {
  id: string;
  name: string;
  propertyName: string | null;
  imageUrl: string | null;
  bedrooms: number;
  /** Set for units that can't take bookings right now, e.g. "Maintenance". */
  statusLabel: string | null;
}

/**
 * The calendar's unit switcher: one chip per unit, as plain links so the
 * choice applies instantly and lives in the URL (the month is kept).
 */
export function UnitFilter({ units, selectedId, hrefFor }: {
  units: UnitFilterOption[];
  selectedId: string | null;
  hrefFor: (unitId: string | null) => string;
}) {
  const showProperty = new Set(units.map((unit) => unit.propertyName)).size > 1;
  return (
    <nav aria-label="Show calendar for" className="-mx-1 mb-5 overflow-x-auto px-1 pb-1">
      <ul className="flex w-max gap-2">
        <li>
          <Chip href={hrefFor(null)} active={selectedId === null}>
            <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", selectedId === null ? "bg-white/15" : "bg-sage/60 text-pine")}><LayoutGrid className="h-4 w-4" aria-hidden /></span>
            <span className="min-w-0">
              <span className="block text-sm font-medium">All units</span>
              <span className={cn("block text-xs", selectedId === null ? "text-white/70" : "text-ink/50")}>{units.length} {units.length === 1 ? "unit" : "units"}</span>
            </span>
          </Chip>
        </li>
        {units.map((unit) => {
          const active = unit.id === selectedId;
          return (
            <li key={unit.id}>
              <Chip href={hrefFor(unit.id)} active={active} muted={Boolean(unit.statusLabel)}>
                <span className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-sage/60 text-pine">
                  {unit.imageUrl
                    // eslint-disable-next-line @next/next/no-img-element -- owner-uploaded covers are self-contained URLs
                    ? <img src={unit.imageUrl} alt="" className="h-full w-full object-cover" />
                    : <Building2 className="h-4 w-4" aria-hidden />}
                </span>
                <span className="min-w-0">
                  <span className="block max-w-44 truncate text-sm font-medium">{unit.name}</span>
                  <span className={cn("flex items-center gap-1 text-xs", active ? "text-white/70" : "text-ink/50")}>
                    {unit.statusLabel
                      ? <span className={cn("rounded px-1 font-medium", active ? "bg-white/15" : "bg-amber-100 text-amber-900")}>{unit.statusLabel}</span>
                      : <><BedDouble className="h-3 w-3" aria-hidden />{unit.bedrooms || "Studio"}</>}
                    {showProperty && unit.propertyName ? <span className="max-w-32 truncate">· {unit.propertyName}</span> : null}
                  </span>
                </span>
              </Chip>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function Chip({ href, active, muted, children }: { href: string; active: boolean; muted?: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      scroll={false}
      className={cn(
        "flex items-center gap-2.5 rounded-xl border py-1.5 pl-1.5 pr-3.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay",
        active ? "border-pine bg-pine text-white shadow-[0_4px_12px_rgba(32,58,53,0.18)]" : "border-pine/15 bg-white text-pine hover:border-pine/35",
        muted && !active && "opacity-75",
      )}
    >
      {children}
    </Link>
  );
}
