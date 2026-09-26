"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Banknote, BedDouble, Receipt, ShieldCheck, TrendingUp, type LucideIcon } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import {
  bucketize,
  change,
  inWindow,
  RANGE_KEYS,
  RANGE_LABELS,
  rangeWindows,
  sumDays,
  type Bucket,
  type DashboardSeries,
  type RangeKey,
} from "@/lib/dashboard-series";
import { addDaysLocal } from "@/lib/dates";
import { EXPENSE_CATEGORY_LABELS } from "@/lib/labels";
import type { ExpenseCategory } from "@/lib/db/schema";
import { cn } from "@/lib/utils";
import {
  axisTick,
  CATEGORY_COLORS,
  CHART,
  dayLabel,
  LegendToggle,
  monthLabel,
  monthYearLabel,
  percent,
  peso,
  pesoCompact,
  Segmented,
  TooltipCard,
} from "./chart-kit";

type Metric = "collected" | "net" | "occupancy" | "expenses";

export interface MonthBalances {
  depositsHeldCents: number;
  bookedValueCents: number;
  month: string;
}

function bucketTitle(bucket: Bucket, range: RangeKey) {
  if (range === "30d") return dayLabel(bucket.start);
  if (range === "13w") return `${dayLabel(bucket.start)} – ${dayLabel(bucket.end)}`;
  return monthYearLabel(bucket.start);
}

function tickLabel(start: string, range: RangeKey) {
  return range === "12m" ? monthLabel(start) : dayLabel(start);
}

export function PerformanceSection({ series, today, balances }: { series: DashboardSeries; today: string; balances: MonthBalances | null }) {
  const router = useRouter();
  const [range, setRange] = useState<RangeKey>("30d");
  const [metric, setMetric] = useState<Metric>("collected");
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [includeCapital, setIncludeCapital] = useState(false);
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);

  const windows = rangeWindows(range, today);
  const current = sumDays(series.days.filter(inWindow(windows.current)));
  const previous = sumDays(series.days.filter(inWindow(windows.previous)));
  const buckets = bucketize(series.days, range, today);
  // Plot pesos, not centavos, so the axis picks round peso ticks.
  const chartData = buckets.map((bucket) => ({
    ...bucket,
    collected: bucket.collectedCents / 100,
    expenses: bucket.expensesCents / 100,
    net: bucket.netCents / 100,
    occupancyPct: bucket.occupancyRate === null ? null : bucket.occupancyRate * 100,
  }));

  const categoryTotals = new Map<string, number>();
  for (const row of series.categories.filter(inWindow(windows.current))) {
    if (!includeCapital && row.classification !== "operating") continue;
    categoryTotals.set(row.category, (categoryTotals.get(row.category) ?? 0) + row.amountCents);
  }
  const categories = [...categoryTotals].map(([category, amountCents]) => ({ category, amountCents })).sort((a, b) => b.amountCents - a.amountCents);
  const spendingTotal = categories.reduce((sum, row) => sum + row.amountCents, 0);

  const propertyRows = series.properties.map((property) => {
    let occupied = 0;
    let bookable = 0;
    series.days.forEach((day, index) => {
      if (day.date < windows.current.from || day.date >= windows.current.to) return;
      occupied += property.occupied[index]!;
      bookable += property.bookable[index]!;
    });
    return { name: property.name, occupied, bookable, rate: bookable ? occupied / bookable : 0 };
  }).sort((a, b) => b.rate - a.rate);

  const tiles: { key: Metric; label: string; value: string; icon: LucideIcon; delta: { text: string; good: boolean } | null; spark: number[] }[] = [
    { key: "collected", label: "Cash collected", value: peso(current.collectedCents), icon: Banknote, delta: moneyDelta(current.collectedCents, previous.collectedCents, true), spark: running(buckets.map((b) => b.collectedCents)) },
    { key: "net", label: "Net operating cash", value: peso(current.netCents), icon: TrendingUp, delta: moneyDelta(current.netCents, previous.netCents, true), spark: running(buckets.map((b) => b.netCents)) },
    { key: "occupancy", label: "Occupancy", value: percent(current.occupancyRate), icon: BedDouble, delta: pointsDelta(current.occupancyRate, previous.occupancyRate), spark: buckets.map((b) => (b.occupancyRate ?? 0) * 100) },
    { key: "expenses", label: "Operating expenses", value: peso(current.expensesCents), icon: Receipt, delta: moneyDelta(current.expensesCents, previous.expensesCents, false), spark: running(buckets.map((b) => b.expensesCents)) },
  ];

  const toggle = (key: string) => setHidden((set) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  const openReport = (bucket: Bucket | undefined) => {
    if (bucket) router.push(`/reports?from=${bucket.start}&to=${addDaysLocal(bucket.end, 1)}`);
  };
  // Daily cash is lumpy, so a daily net line just zig-zags; 30D keeps net in the tooltip.
  const showNetLine = range !== "30d" && !hidden.has("net");
  const moneyAxis = niceTicks(chartData.flatMap((row) => [hidden.has("collected") ? 0 : row.collected, hidden.has("expenses") ? 0 : row.expenses, showNetLine ? row.net : 0]));
  const emphasis = (key: Metric) => (metric === key || metric === "occupancy" ? 1 : 0.32);
  const averageOccupancy = current.occupancyRate === null ? null : current.occupancyRate * 100;
  const hovered = categories.find((row) => row.category === hoveredCategory);

  return (
    <section aria-labelledby="performance-heading" className="mt-10">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="performance-heading" className="font-display text-2xl text-pine sm:text-3xl">How your stays are doing</h2>
          <p className="mt-1 text-xs text-ink/55">{RANGE_LABELS[range].long} · {dayLabel(windows.current.from)} – {dayLabel(today)}, compared with the {RANGE_LABELS[range].long.replace("Last ", "previous ")}. Cash basis, Manila time.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Segmented label="Period" options={RANGE_KEYS.map((key) => ({ value: key, label: RANGE_LABELS[key].short }))} value={range} onChange={setRange} />
          <Link href="/reports" className="inline-flex items-center gap-1.5 text-sm font-medium text-clay-deep hover:underline">Full reports<ArrowRight className="h-4 w-4" aria-hidden /></Link>
        </div>
      </div>

      <div role="tablist" aria-label="Chart metric" className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map(({ key, label, value, icon: Icon, delta, spark }) => {
          const active = metric === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls="performance-chart"
              onClick={() => setMetric(key)}
              className={cn(
                "group relative overflow-hidden rounded-xl border p-4 text-left transition sm:p-5",
                active ? "border-pine/35 bg-linen shadow-[0_8px_24px_rgba(32,58,53,0.08)] ring-1 ring-pine/10" : "border-pine/12 bg-linen/70 hover:border-pine/25 hover:bg-linen",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <span className={cn("flex h-9 w-9 items-center justify-center rounded-full transition-colors", active ? "bg-pine text-white" : "bg-pine-mist text-pine")}><Icon className="h-4 w-4" strokeWidth={1.8} aria-hidden /></span>
                {delta ? (
                  <span className={cn("inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums", delta.good ? "bg-sage/60 text-pine" : "bg-clay-mist text-clay-deep")}>
                    {delta.text.startsWith("-") ? <ArrowDownRight className="h-3 w-3" aria-hidden /> : <ArrowUpRight className="h-3 w-3" aria-hidden />}
                    {delta.text.replace(/^[-+]/, "")}
                    <span className="sr-only"> vs previous period</span>
                  </span>
                ) : <span className="text-[11px] text-ink/35">No prior data</span>}
              </div>
              <p className="mt-4 text-xs text-ink/55">{label}</p>
              <p className="mt-1 font-display text-2xl tabular-nums text-pine sm:text-[1.7rem]">{value}</p>
              <div className="mt-3 h-10" aria-hidden>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={spark.map((v, i) => ({ i, v }))} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id={`spark-${key}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={key === "expenses" ? CHART.sand : CHART.moss} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={key === "expenses" ? CHART.sand : CHART.moss} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="v" stroke={key === "expenses" ? CHART.sand : active ? CHART.pine : CHART.moss} strokeWidth={1.75} fill={`url(#spark-${key})`} isAnimationActive={false} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </button>
          );
        })}
      </div>

      <Card id="performance-chart" role="tabpanel" aria-labelledby="performance-chart-title" className="mt-4">
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 id="performance-chart-title" className="font-display text-lg text-pine">{metric === "occupancy" ? "Occupancy" : "Cash flow"}</h3>
            <p className="mt-0.5 text-xs text-ink/50">{metric === "occupancy" ? "Occupied ÷ bookable nights on active units. Dashed line is the period average." : "Booking cash in vs operating cash out. Hover for detail; click a bar to open that period in Reports."}</p>
          </div>
          {metric !== "occupancy" ? (
            <div className="flex flex-wrap gap-1">
              <LegendToggle label="Collected" color={CHART.pine} active={!hidden.has("collected")} onClick={() => toggle("collected")} />
              <LegendToggle label="Operating expenses" color={CHART.sand} active={!hidden.has("expenses")} onClick={() => toggle("expenses")} />
              {range !== "30d" ? <LegendToggle label="Net" color={CHART.clay} shape="line" active={!hidden.has("net")} onClick={() => toggle("net")} /> : null}
            </div>
          ) : null}
        </CardHeader>
        <CardBody className="px-2 pb-4 pt-5 sm:px-4">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              {metric === "occupancy" ? (
                <AreaChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }} onClick={(state) => openReport(buckets[Number(state?.activeTooltipIndex)])} className="cursor-pointer">
                  <defs>
                    <linearGradient id="occupancy-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART.moss} stopOpacity={0.4} />
                      <stop offset="100%" stopColor={CHART.moss} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke={CHART.grid} />
                  <XAxis dataKey="start" tickFormatter={(value: string) => tickLabel(value, range)} tick={axisTick} tickLine={false} axisLine={false} minTickGap={16} />
                  <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(value: number) => `${value}%`} tick={axisTick} tickLine={false} axisLine={false} width={44} />
                  {averageOccupancy !== null ? <ReferenceLine y={averageOccupancy} stroke={CHART.clay} strokeDasharray="4 4" strokeOpacity={0.7} /> : null}
                  <Tooltip
                    cursor={{ stroke: CHART.pine, strokeOpacity: 0.2 }}
                    content={({ active, payload }) => {
                      const bucket = active ? (payload?.[0]?.payload as Bucket | undefined) : undefined;
                      return bucket ? <TooltipCard title={bucketTitle(bucket, range)} rows={[
                        { label: "Occupancy", value: percent(bucket.occupancyRate), color: CHART.moss },
                        { label: "Occupied nights", value: String(bucket.occupied) },
                        { label: "Bookable nights", value: String(bucket.bookable) },
                      ]} /> : null;
                    }}
                  />
                  <Area animationDuration={450} type="monotone" dataKey="occupancyPct" stroke={CHART.pine} strokeWidth={2} fill="url(#occupancy-fill)" connectNulls activeDot={{ r: 5, fill: CHART.pine, stroke: "#fbfaf7", strokeWidth: 2 }} />
                </AreaChart>
              ) : (
                <ComposedChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }} barGap={2} onClick={(state) => openReport(buckets[Number(state?.activeTooltipIndex)])} className="cursor-pointer">
                  <CartesianGrid vertical={false} stroke={CHART.grid} />
                  <XAxis dataKey="start" tickFormatter={(value: string) => tickLabel(value, range)} tick={axisTick} tickLine={false} axisLine={false} minTickGap={16} />
                  <YAxis domain={moneyAxis.domain} ticks={moneyAxis.ticks} tickFormatter={(value: number) => pesoCompact(value * 100)} tick={axisTick} tickLine={false} axisLine={false} width={64} />
                  <ReferenceLine y={0} stroke={CHART.pine} strokeOpacity={0.2} />
                  <Tooltip
                    cursor={{ fill: CHART.pine, fillOpacity: 0.05 }}
                    content={({ active, payload }) => {
                      const bucket = active ? (payload?.[0]?.payload as Bucket | undefined) : undefined;
                      return bucket ? <TooltipCard title={bucketTitle(bucket, range)} rows={[
                        { label: "Collected", value: peso(bucket.collectedCents), color: CHART.pine },
                        { label: "Refunded", value: peso(bucket.refundedCents) },
                        { label: "Operating expenses", value: peso(bucket.expensesCents), color: CHART.sand },
                        { label: "Net operating cash", value: peso(bucket.netCents), color: CHART.clay },
                      ]} footer="Click to open in Reports" /> : null;
                    }}
                  />
                  {!hidden.has("collected") ? <Bar animationDuration={450} dataKey="collected" name="Collected" fill={CHART.pine} fillOpacity={emphasis("collected")} radius={[4, 4, 0, 0]} maxBarSize={28} /> : null}
                  {!hidden.has("expenses") ? <Bar animationDuration={450} dataKey="expenses" name="Operating expenses" fill={CHART.sand} fillOpacity={emphasis("expenses")} radius={[4, 4, 0, 0]} maxBarSize={28} /> : null}
                  {showNetLine ? <Line animationDuration={450} type="linear" dataKey="net" name="Net" stroke={CHART.clay} strokeOpacity={metric === "net" ? 1 : 0.55} strokeWidth={metric === "net" ? 2.5 : 2} dot={false} activeDot={{ r: 5, fill: CHART.clay, stroke: "#fbfaf7", strokeWidth: 2 }} /> : null}
                </ComposedChart>
              )}
            </ResponsiveContainer>
          </div>
          <div className="sr-only"><table>
            <caption>{RANGE_LABELS[range].long}: cash and occupancy by period</caption>
            <thead><tr><th scope="col">Period</th><th scope="col">Collected</th><th scope="col">Operating expenses</th><th scope="col">Net</th><th scope="col">Occupancy</th></tr></thead>
            <tbody>{buckets.map((bucket) => <tr key={bucket.start}><th scope="row">{bucketTitle(bucket, range)}</th><td>{peso(bucket.collectedCents)}</td><td>{peso(bucket.expensesCents)}</td><td>{peso(bucket.netCents)}</td><td>{percent(bucket.occupancyRate)}</td></tr>)}</tbody>
          </table></div>
        </CardBody>
      </Card>

      <div className={cn("mt-4 grid grid-cols-[minmax(0,1fr)] items-stretch gap-4", propertyRows.length > 1 ? "lg:grid-cols-2 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(16rem,0.7fr)]" : "lg:grid-cols-[minmax(0,1.4fr)_minmax(16rem,0.7fr)]")}>
        <Card aria-labelledby="spending-title">
          <CardHeader className="flex flex-wrap items-center justify-between gap-2">
            <div><h3 id="spending-title" className="font-display text-lg text-pine">Spending by category</h3><p className="mt-0.5 text-xs text-ink/50">Expenses paid, {RANGE_LABELS[range].long.toLowerCase()}.</p></div>
            <Segmented size="sm" label="Spending scope" options={[{ value: "operating", label: "Operating" }, { value: "all", label: "Incl. capital" }]} value={includeCapital ? "all" : "operating"} onChange={(value) => setIncludeCapital(value === "all")} />
          </CardHeader>
          <CardBody className="@container">
            {categories.length === 0 ? (
              <div className="flex h-48 flex-col items-center justify-center text-center"><Receipt className="h-6 w-6 text-sage-deep" aria-hidden /><p className="mt-2 text-sm text-ink/55">No expenses recorded in this period.</p><Link href="/expenses/new" className="mt-1 text-xs font-medium text-clay-deep hover:underline">Record an expense</Link></div>
            ) : (
              <div className="grid items-center gap-5 @md:grid-cols-[11rem_minmax(0,1fr)]">
                <div className="relative mx-auto h-44 w-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={categories} dataKey="amountCents" nameKey="category" innerRadius="64%" outerRadius="100%" paddingAngle={categories.length > 1 ? 2 : 0} stroke="none" isAnimationActive={false} onMouseEnter={(_, index) => setHoveredCategory(categories[index]?.category ?? null)} onMouseLeave={() => setHoveredCategory(null)}>
                        {categories.map((row) => <Cell key={row.category} fill={CATEGORY_COLORS[row.category] ?? CHART.sageDeep} fillOpacity={hoveredCategory === null || hoveredCategory === row.category ? 1 : 0.3} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-ink/45">{hovered ? categoryLabel(hovered.category) : "Total"}</p>
                    <p className="mt-0.5 font-display text-lg tabular-nums text-pine">{pesoCompact(hovered?.amountCents ?? spendingTotal)}</p>
                    {hovered ? <p className="text-[11px] text-ink/50">{percent(hovered.amountCents / spendingTotal)}</p> : null}
                  </div>
                </div>
                <ul className="space-y-1">
                  {categories.map((row) => (
                    <li key={row.category}>
                      <button type="button" onMouseEnter={() => setHoveredCategory(row.category)} onMouseLeave={() => setHoveredCategory(null)} onFocus={() => setHoveredCategory(row.category)} onBlur={() => setHoveredCategory(null)} className={cn("flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition", hoveredCategory === row.category ? "bg-pine-mist/70" : "hover:bg-pine-mist/40")}>
                        <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: CATEGORY_COLORS[row.category] ?? CHART.sageDeep }} aria-hidden />
                        <span className="min-w-0 flex-1 truncate text-ink/70">{categoryLabel(row.category)}</span>
                        <span className="tabular-nums text-ink/45">{percent(row.amountCents / spendingTotal)}</span>
                        <span className="w-20 text-right font-medium tabular-nums text-pine">{peso(row.amountCents)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardBody>
        </Card>

        {propertyRows.length > 1 ? (
          <Card aria-labelledby="property-occupancy-title">
            <CardHeader><h3 id="property-occupancy-title" className="font-display text-lg text-pine">Occupancy by property</h3><p className="mt-0.5 text-xs text-ink/50">{RANGE_LABELS[range].long}, highest first.</p></CardHeader>
            <CardBody className="px-2 sm:px-4">
              <div style={{ height: Math.max(160, propertyRows.length * 44) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={propertyRows.map((row) => ({ ...row, pct: row.rate * 100 }))} layout="vertical" margin={{ top: 0, right: 40, bottom: 0, left: 0 }}>
                    <XAxis type="number" domain={[0, 100]} hide />
                    <YAxis type="category" dataKey="name" width={132} tickFormatter={(name: string) => (name.length > 16 ? `${name.slice(0, 15).trimEnd()}…` : name)} tick={{ ...axisTick, fill: CHART.pine }} tickLine={false} axisLine={false} />
                    <Tooltip
                      cursor={{ fill: CHART.pine, fillOpacity: 0.04 }}
                      content={({ active, payload }) => {
                        const row = active ? (payload?.[0]?.payload as (typeof propertyRows)[number] | undefined) : undefined;
                        return row ? <TooltipCard title={row.name} rows={[{ label: "Occupancy", value: percent(row.rate), color: CHART.moss }, { label: "Occupied nights", value: String(row.occupied) }, { label: "Bookable nights", value: String(row.bookable) }]} /> : null;
                      }}
                    />
                    <Bar animationDuration={450} dataKey="pct" fill={CHART.moss} radius={[0, 4, 4, 0]} barSize={14} background={{ fill: CHART.mist, radius: 4 }} label={{ position: "right", formatter: (value: unknown) => `${Math.round(Number(value))}%`, fill: CHART.pine, fontSize: 11 }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardBody>
          </Card>
        ) : null}

        <Card aria-labelledby="balances-title" className="bg-pine text-white">
          <CardBody className="flex h-full flex-col gap-5 p-5 sm:p-6">
            <div className="flex items-center justify-between"><h3 id="balances-title" className="font-display text-lg">Balances</h3><ShieldCheck className="h-5 w-5 text-sage" aria-hidden /></div>
            {balances ? (
              <>
                <div><p className="text-xs text-white/60">Security deposits held</p><p className="mt-1 font-display text-3xl tabular-nums">{peso(balances.depositsHeldCents)}</p><p className="mt-1 text-[11px] text-white/50">Refundable to guests — a liability, not revenue.</p></div>
                <div className="border-t border-white/12 pt-4"><p className="text-xs text-white/60">Booked value, {monthYearLabel(`${balances.month}-01`)}</p><p className="mt-1 font-display text-2xl tabular-nums">{peso(balances.bookedValueCents)}</p><p className="mt-1 text-[11px] text-white/50">Stay nights falling in this month, whether paid yet or not.</p></div>
              </>
            ) : <p className="text-sm text-white/70">Balances are temporarily unavailable.</p>}
            <Link href="/reports" className="mt-auto inline-flex items-center gap-1.5 text-sm font-medium text-sage hover:text-white">Open reports<ArrowRight className="h-4 w-4" aria-hidden /></Link>
          </CardBody>
        </Card>
      </div>
    </section>
  );
}

function categoryLabel(category: string) {
  return EXPENSE_CATEGORY_LABELS[category as ExpenseCategory] ?? category;
}

function moneyDelta(current: number, previous: number, upIsGood: boolean) {
  const value = change(current, previous);
  if (value === null) return null;
  const rounded = Math.round(value * 100);
  return { text: `${rounded < 0 ? "-" : "+"}${Math.abs(rounded)}%`, good: rounded === 0 || (rounded > 0) === upIsGood };
}

function pointsDelta(current: number | null, previous: number | null) {
  if (current === null || previous === null) return null;
  const points = Math.round((current - previous) * 100);
  return { text: `${points < 0 ? "-" : "+"}${Math.abs(points)} pts`, good: points >= 0 };
}

/** Running total, so money sparklines show how the period built up rather than daily spikes. */
function running(values: number[]) {
  let total = 0;
  return values.map((value) => (total += value));
}

/** Round axis ticks (0, ₱10K, ₱20K…) covering the values, including negatives. */
function niceTicks(values: number[]): { domain: [number, number]; ticks: number[] } {
  const max = Math.max(0, ...values);
  const min = Math.min(0, ...values);
  const span = max - min || 1;
  const raw = span / 4;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((factor) => factor * magnitude).find((candidate) => candidate >= raw)!;
  const low = Math.floor(min / step) * step;
  const high = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let tick = low; tick <= high + step / 2; tick += step) ticks.push(Math.round(tick * 100) / 100);
  return { domain: [low, high], ticks };
}
