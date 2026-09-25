import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { formatPHP } from "@/lib/money";

// Server-rendered charts: plain divs, native `title` tooltips and a
// screen-reader table per chart, so the dashboard ships no chart JavaScript.

const WEEKDAY = new Intl.DateTimeFormat("en-PH", { weekday: "short", timeZone: "UTC" });
const DAY_LABEL = new Intl.DateTimeFormat("en-PH", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
const MONTH = new Intl.DateTimeFormat("en-PH", { month: "short", timeZone: "UTC" });
const MONTH_YEAR = new Intl.DateTimeFormat("en-PH", { month: "long", year: "numeric", timeZone: "UTC" });

const dateOf = (day: string) => new Date(`${day}T00:00:00Z`);
export const monthLabel = (month: string) => MONTH.format(dateOf(`${month}-01`));

function percent(value: number | null) {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

function Legend({ items }: { items: { label: string; swatch: string }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink/60">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-sm ${item.swatch}`} aria-hidden />{item.label}</li>
      ))}
    </ul>
  );
}

export interface OutlookNight {
  date: string;
  booked: number;
  held: number;
  blocked: number;
  free: number;
}

const OUTLOOK_SERIES = [
  { key: "booked", label: "Booked", swatch: "bg-pine" },
  { key: "held", label: "On hold", swatch: "bg-clay" },
  { key: "blocked", label: "Blocked", swatch: "bg-sand-deep" },
] as const;

/** Stacked night-by-night unit states for the coming nights. */
export function OutlookChart({ nights, unitCount, today }: { nights: OutlookNight[]; unitCount: number; today: string }) {
  const bookedNights = nights.reduce((sum, night) => sum + night.booked, 0);
  const total = nights.length * unitCount;
  return (
    <Card aria-labelledby="outlook-title">
      <CardHeader className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="outlook-title" className="font-display text-xl text-pine">Next {nights.length} days</h2>
          <p className="mt-1 text-xs text-ink/50">{bookedNights} of {total} unit-nights booked ({percent(total ? bookedNights / total : null)}) across {unitCount} active unit{unitCount === 1 ? "" : "s"}.</p>
        </div>
        <Legend items={[...OUTLOOK_SERIES, { label: "Free", swatch: "bg-pine-mist" }]} />
      </CardHeader>
      <CardBody>
        <div className="flex h-36 items-end gap-1 sm:gap-1.5" aria-hidden>
          {nights.map((night) => (
            <div key={night.date} className="flex h-full min-w-0 flex-1 flex-col justify-end gap-[2px] rounded-t bg-pine-mist/70" title={`${DAY_LABEL.format(dateOf(night.date))}: ${night.booked} booked, ${night.held} on hold, ${night.blocked} blocked, ${night.free} free`}>
              {[...OUTLOOK_SERIES].reverse().map(({ key, swatch }) => night[key] > 0 ? (
                <div key={key} className={`${swatch} first:rounded-t`} style={{ height: `${(night[key] / unitCount) * 100}%` }} />
              ) : null)}
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-1 sm:gap-1.5" aria-hidden>
          {nights.map((night) => (
            <div key={night.date} className={`min-w-0 flex-1 text-center text-[10px] leading-tight ${night.date === today ? "font-semibold text-clay-deep" : "text-ink/45"}`}>
              <span className="hidden sm:block">{WEEKDAY.format(dateOf(night.date))}</span>{Number(night.date.slice(8))}
            </div>
          ))}
        </div>
        <table className="sr-only">
          <caption>Unit nights by status for the next {nights.length} days</caption>
          <thead><tr><th scope="col">Night</th><th scope="col">Booked</th><th scope="col">On hold</th><th scope="col">Blocked</th><th scope="col">Free</th></tr></thead>
          <tbody>{nights.map((night) => <tr key={night.date}><th scope="row">{DAY_LABEL.format(dateOf(night.date))}</th><td>{night.booked}</td><td>{night.held}</td><td>{night.blocked}</td><td>{night.free}</td></tr>)}</tbody>
        </table>
      </CardBody>
    </Card>
  );
}

export interface TrendPoint {
  month: string;
  collectedCents: number;
  operatingExpensesCents: number;
  occupancyRate: number | null;
}

/**
 * Monthly cash in vs out, with occupancy as its own row beneath: the two
 * measures never share an axis.
 */
export function TrendChart({ points }: { points: TrendPoint[] }) {
  const max = Math.max(...points.flatMap((point) => [point.collectedCents, point.operatingExpensesCents]), 1);
  return (
    <Card aria-labelledby="trend-title">
      <CardHeader className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 id="trend-title" className="font-display text-lg text-pine">{points.length}-month trend</h3>
          <p className="mt-1 text-xs text-ink/50">Booking cash collected vs operating expenses paid, by month.</p>
        </div>
        <Legend items={[{ label: "Collected", swatch: "bg-pine" }, { label: "Operating expenses", swatch: "bg-sand-deep" }]} />
      </CardHeader>
      <CardBody>
        <div className="grid gap-2 sm:gap-4" style={{ gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))` }} aria-hidden>
          {points.map((point) => (
            <div key={point.month} className="flex h-40 items-end justify-center gap-[2px] border-b border-pine/15" title={`${MONTH_YEAR.format(dateOf(`${point.month}-01`))}: ${formatPHP(point.collectedCents)} collected, ${formatPHP(point.operatingExpensesCents)} operating expenses`}>
              {[{ value: point.collectedCents, swatch: "bg-pine" }, { value: point.operatingExpensesCents, swatch: "bg-sand-deep" }].map(({ value, swatch }, index) => (
                <div key={index} className={`w-full max-w-5 rounded-t ${swatch}`} style={{ height: `${(value / max) * 100}%`, minHeight: value > 0 ? 3 : 0 }} />
              ))}
            </div>
          ))}
          {points.map((point, index) => (
            <p key={point.month} className={`text-center text-[11px] ${index === points.length - 1 ? "font-semibold text-pine" : "text-ink/50"}`}>{monthLabel(point.month)}</p>
          ))}
        </div>
        <div className="mt-4 border-t border-pine/10 pt-3">
          <p className="mb-2 text-xs text-ink/55">Occupancy</p>
          <div className="grid gap-2 sm:gap-4" style={{ gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))` }} aria-hidden>
            {points.map((point) => (
              <div key={point.month} title={`${MONTH_YEAR.format(dateOf(`${point.month}-01`))}: ${percent(point.occupancyRate)} occupancy`}>
                <div className="h-1.5 overflow-hidden rounded-full bg-pine-mist"><div className="h-full rounded-full bg-clay" style={{ width: `${(point.occupancyRate ?? 0) * 100}%` }} /></div>
                <p className="mt-1 text-center text-[11px] tabular-nums text-ink/60">{percent(point.occupancyRate)}</p>
              </div>
            ))}
          </div>
        </div>
        <table className="sr-only">
          <caption>Monthly cash and occupancy</caption>
          <thead><tr><th scope="col">Month</th><th scope="col">Collected</th><th scope="col">Operating expenses</th><th scope="col">Occupancy</th></tr></thead>
          <tbody>{points.map((point) => <tr key={point.month}><th scope="row">{MONTH_YEAR.format(dateOf(`${point.month}-01`))}</th><td>{formatPHP(point.collectedCents)}</td><td>{formatPHP(point.operatingExpensesCents)}</td><td>{percent(point.occupancyRate)}</td></tr>)}</tbody>
        </table>
      </CardBody>
    </Card>
  );
}

/** Labelled horizontal bars; values are always printed, so color is never the only cue. */
export function BarListCard({ id, title, description, rows, formatValue, empty }: {
  id: string;
  title: string;
  description: string;
  rows: { label: string; value: number; color: string }[];
  formatValue: (value: number) => string;
  empty?: string;
}) {
  const max = Math.max(...rows.map((row) => row.value), 1);
  return (
    <Card aria-labelledby={id}>
      <CardHeader><h3 id={id} className="font-display text-lg text-pine">{title}</h3><p className="mt-1 text-xs text-ink/50">{description}</p></CardHeader>
      <CardBody className="space-y-4">
        {rows.length === 0 && empty ? <p className="text-sm text-ink/55">{empty}</p> : null}
        {rows.map((row) => (
          <div key={row.label}>
            <div className="mb-1.5 flex items-center justify-between gap-3 text-xs"><span className="min-w-0 truncate text-ink/60">{row.label}</span><span className="font-medium tabular-nums text-pine">{formatValue(row.value)}</span></div>
            <div className="h-3 overflow-hidden rounded-full bg-pine-mist/80"><div className={`h-full rounded-full ${row.color}`} style={{ width: `${(row.value / max) * 100}%`, minWidth: row.value > 0 ? "0.75rem" : 0 }} /></div>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}
