import { DateInput } from "@/components/ui/date-input";
import type { Metadata } from "next";
import { PermissionDenied } from "@/components/app/permission-denied";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Label, Select } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireOwner } from "@/lib/auth/session";
import { addDaysLocal, monthNightRange, todayInTimeZone } from "@/lib/dates";
import { formatPHP } from "@/lib/money";
import type { ReportSummary } from "@/lib/reporting";
import { getReport, ReportError } from "@/server/reports/service";
import { listProperties } from "@/server/inventory/service";

export const metadata: Metadata = { title: "Reports" };

const DATE_LABEL = new Intl.DateTimeFormat("en-PH", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

function formatPercent(rate: number | null): string {
  if (rate === null) return "—";
  return `${(rate * 100).toFixed(1)}%`;
}

function Metric({
  label,
  basis,
  value,
  tone = "default",
}: {
  label: string;
  basis: string;
  value: string;
  tone?: "default" | "accent" | "danger";
}) {
  const valueClass =
    tone === "accent"
      ? "text-pine"
      : tone === "danger"
        ? "text-clay-deep"
        : "text-ink";
  return (
    <div className="rounded-xl bg-paper px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-ink/45">
        {label}
      </p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${valueClass}`}>
        {value}
      </p>
      <p className="mt-0.5 text-xs text-ink/50">{basis}</p>
    </div>
  );
}

function HorizontalBars({
  title,
  items,
  formatValue,
}: {
  title: string;
  items: { label: string; value: number; tone: string }[];
  formatValue: (value: number) => string;
}) {
  const max = Math.max(1, ...items.map((item) => Math.abs(item.value)));
  return (
    <Card>
      <CardHeader><h3 className="font-display text-lg text-pine">{title}</h3></CardHeader>
      <CardBody className="space-y-4">
        {items.map((item) => (
          <div key={item.label}>
            <div className="mb-1 flex justify-between gap-3 text-sm"><span className="text-ink/70">{item.label}</span><span className="shrink-0 font-medium tabular-nums text-pine">{formatValue(item.value)}</span></div>
            <div className="h-3 overflow-hidden rounded-full bg-pine-mist/60"><div className={`h-full rounded-full ${item.tone}`} style={{ width: `${Math.max(0, Math.min(100, (Math.abs(item.value) / max) * 100))}%` }} /></div>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const membership = await requireOwner();
  if (!membership) {
    return (
      <PermissionDenied description="Reports are limited to the organization owner. Staff members can use the calendar, reservations, guests and tasks pages." />
    );
  }

  const params = await searchParams;
  const readParam = (key: string) => {
    const value = params[key];
    return typeof value === "string" ? value.trim() : "";
  };

  const timezone = "Asia/Manila";
  const defaultRange = monthNightRange(
    todayInTimeZone(timezone).slice(0, 7),
  );
  const from = readParam("from") || defaultRange.start;
  const to = readParam("to") || defaultRange.end;
  const propertyFilter = readParam("property");

  const properties = await listProperties(membership.organizationId);

  let result: Awaited<ReturnType<typeof getReport>> | null = null;
  let error: string | null = null;
  try {
    result = await getReport(membership.organizationId, {
      propertyId: propertyFilter || undefined,
      from,
      to,
    });
  } catch (err) {
    error =
      err instanceof ReportError
        ? err.message
        : "The report could not be generated.";
  }

  const hasFilters = Boolean(readParam("from") || readParam("to") || propertyFilter);
  const periodLabel = (() => {
    if (!result) return "";
    const lastNight = addDaysLocal(result.summary.to, -1);
    return `${DATE_LABEL.format(new Date(`${result.summary.from}T00:00:00Z`))} – ${DATE_LABEL.format(new Date(`${lastNight}T00:00:00Z`))}`;
  })();

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-pine">Reports</h1>
          <p className="mt-1 text-sm text-ink/60">
            Cash, bookings and occupancy — each metric labeled with its basis.
          </p>
        </div>
        {result ? (
          <p className="text-sm text-ink/60">
            {periodLabel} · {result.timezone} cash basis · {result.summary.activeUnitCount}{" "}
            {result.summary.activeUnitCount === 1 ? "unit" : "units"} active
          </p>
        ) : null}
      </div>

      <form method="GET" className="mt-5 flex flex-wrap items-end gap-3">
        <div className="min-w-44">
          <Label htmlFor="filter-property">Property</Label>
          <Select
            id="filter-property"
            name="property"
            defaultValue={propertyFilter}
          >
            <option value="">All properties</option>
            {properties.map((property) => (
              <option key={property.id} value={property.id}>
                {property.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="filter-from">From</Label>
          <DateInput id="filter-from" name="from" defaultValue={from} className="w-56" />
        </div>
        <div>
          <Label htmlFor="filter-to">To (exclusive)</Label>
          <DateInput id="filter-to" name="to" defaultValue={to} className="w-56" />
        </div>
        <button
          type="submit"
          className="h-10 rounded-lg bg-pine px-4 text-sm font-medium text-white hover:bg-pine-soft"
        >
          Run report
        </button>
        {hasFilters ? (
          <a
            href="/reports"
            className="h-10 inline-flex items-center rounded-lg px-3 text-sm text-pine hover:bg-pine-mist/70"
          >
            Clear
          </a>
        ) : null}
      </form>

      {error ? (
        <div className="mt-6">
          <EmptyState title="Report unavailable" description={error} />
        </div>
      ) : result ? (
        <ReportBody summary={result.summary} propertyNames={result.propertyNames} />
      ) : null}
    </div>
  );
}

function ReportBody({
  summary,
  propertyNames,
}: {
  summary: ReportSummary;
  propertyNames: Map<string, string>;
}) {
  const cashBasis = "payments received in period";
  const stayBasis = "stays overlapping the period";
  return (
    <div className="mt-6 space-y-6">
      <section aria-labelledby="cash-heading">
        <Card>
          <CardHeader className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="cash-heading" className="font-display text-lg text-pine">
              Cash view
            </h2>
            <Badge tone="neutral">{cashBasis}</Badge>
          </CardHeader>
          <CardBody>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Metric
                label="Booking payments collected"
                basis={cashBasis}
                value={formatPHP(summary.bookingCollectedCents)}
              />
              <Metric
                label="Booking refunds paid"
                basis="refunds sent in period"
                value={formatPHP(summary.bookingRefundedCents)}
              />
              <Metric
                label="Security deposits collected"
                basis={cashBasis}
                value={formatPHP(summary.depositCollectedCents)}
              />
              <Metric
                label="Security deposits refunded"
                basis="refunds sent in period"
                value={formatPHP(summary.depositRefundedCents)}
              />
              <Metric
                label="Deposits kept via deductions"
                basis="deductions recorded in period"
                value={formatPHP(summary.depositsRetainedCents)}
              />
              <Metric
                label="Deposits held"
                basis="all time: collected − refunded − kept"
                value={formatPHP(summary.depositsHeldCents)}
              />
            </div>
            <div className="mt-4 rounded-xl border border-pine/15 bg-pine-mist/40 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-ink/45">
                Net operating cash
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-pine">
                {formatPHP(summary.netOperatingCashCents)}
              </p>
              <p className="mt-1 text-xs text-ink/55">
                Booking payments collected − booking refunds − operating
                expenses. It excludes refundable deposits and capital spending,
                and it is not taxable income, ROI, or accrual profit.
              </p>
            </div>
          </CardBody>
        </Card>
      </section>

      <section aria-label="Report charts" className="grid gap-6 lg:grid-cols-2">
        <HorizontalBars
          title="Cash movement"
          formatValue={formatPHP}
          items={[
            { label: "Booking payments", value: summary.bookingCollectedCents, tone: "bg-pine" },
            { label: "Operating expenses", value: summary.operatingExpensesCents, tone: "bg-clay" },
            { label: "Booking refunds", value: summary.bookingRefundedCents, tone: "bg-[#c88470]" },
            { label: "Net operating cash", value: summary.netOperatingCashCents, tone: summary.netOperatingCashCents < 0 ? "bg-clay-deep" : "bg-sage-deep" },
          ]}
        />
        <HorizontalBars
          title="Occupancy by property"
          formatValue={(value) => formatPercent(value / 100)}
          items={summary.propertyBreakdown.map((row) => ({
            label: propertyNames.get(row.propertyId) ?? "Unknown property",
            value: (row.occupancyRate ?? 0) * 100,
            tone: "bg-sage-deep",
          }))}
        />
      </section>

      <section aria-labelledby="booked-heading">
        <Card>
          <CardHeader className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="booked-heading" className="font-display text-lg text-pine">
              Bookings &amp; occupancy
            </h2>
            <Badge tone="neutral">{stayBasis}</Badge>
          </CardHeader>
          <CardBody>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Metric
                label="Booked value"
                basis={stayBasis}
                value={formatPHP(summary.bookedValueCents)}
                tone="accent"
              />
              <Metric
                label="Accommodation booked"
                basis="agreed total spread across actual stay nights"
                value={formatPHP(summary.accommodationBookedCents)}
              />
              <Metric
                label="Fees & discounts booked"
                basis="counted once on the stay's first night"
                value={formatPHP(summary.oneTimeBookedCents)}
              />
              <Metric
                label="Occupied nights"
                basis={stayBasis}
                value={String(summary.occupiedNights)}
              />
              <Metric
                label="Bookable nights"
                basis="active units, minus blocked nights"
                value={String(summary.bookableNights)}
              />
              <Metric
                label="Occupancy"
                basis="occupied ÷ bookable nights"
                value={formatPercent(summary.occupancyRate)}
              />
              <Metric
                label="Average accommodation rate"
                basis="accommodation booked ÷ all booked stay nights"
                value={
                  summary.avgAccommodationRateCents === null
                    ? "—"
                    : formatPHP(summary.avgAccommodationRateCents)
                }
              />
            </div>
            <p className="mt-4 text-xs text-ink/55">
              Occupancy = occupied nights ÷ bookable nights for the period.
              Both counts use units currently marked Active and exclude blocked
              nights. Historical unit status changes are not reconstructed.
              Holds, cancelled and expired stays never count as occupied.
              Booked value and average accommodation rate include all booked stay
              nights, even for units now inactive, but never refundable deposits.
            </p>
          </CardBody>
        </Card>
      </section>

      <section aria-labelledby="expenses-heading">
        <Card>
          <CardHeader className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="expenses-heading" className="font-display text-lg text-pine">
              Spending
            </h2>
            <Badge tone="neutral">expenses paid in period</Badge>
          </CardHeader>
          <CardBody>
            <div className="grid gap-3 sm:grid-cols-2">
              <Metric
                label="Operating expenses"
                basis="classification: operating"
                value={formatPHP(summary.operatingExpensesCents)}
              />
              <Metric
                label="Capital spending"
                basis="classification: capital — excluded from net operating cash"
                value={formatPHP(summary.capitalSpendingCents)}
              />
            </div>
          </CardBody>
        </Card>
      </section>

      <section aria-labelledby="breakdown-heading">
        <Card>
          <CardHeader>
            <h2 id="breakdown-heading" className="font-display text-lg text-pine">
              Occupancy by property
            </h2>
          </CardHeader>
          <CardBody className="p-0">
            {summary.propertyBreakdown.length === 0 ? (
              <p className="px-6 py-5 text-sm text-ink/60">
                No properties in scope for this report.
              </p>
            ) : (
              <Table aria-labelledby="breakdown-heading">
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">Property</TableHead>
                    <TableHead scope="col" className="text-right">Occupied nights</TableHead>
                    <TableHead scope="col" className="text-right">Bookable nights</TableHead>
                    <TableHead scope="col" className="text-right">Occupancy</TableHead>
                    <TableHead scope="col" className="text-right">Avg rate / night</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.propertyBreakdown.map((row) => (
                    <TableRow key={row.propertyId}>
                      <TableCell className="text-pine">
                        {propertyNames.get(row.propertyId) ?? "Unknown property"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-ink/70">
                        {row.occupiedNights}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-ink/70">
                        {row.bookableNights}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium text-pine">
                        {formatPercent(row.occupancyRate)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-ink/70">
                        {row.avgAccommodationRateCents === null
                          ? "—"
                          : formatPHP(row.avgAccommodationRateCents)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardBody>
        </Card>
      </section>
    </div>
  );
}
