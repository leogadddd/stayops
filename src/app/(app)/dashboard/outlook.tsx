"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { axisTick, CHART, dayLabel, LegendToggle, percent, Segmented, TooltipCard, weekdayLabel } from "./chart-kit";

export interface OutlookNight {
  date: string;
  booked: number;
  held: number;
  blocked: number;
  free: number;
  /** Guests whose stay starts this night. */
  arrivals: string[];
}

const SPANS = [
  { value: "7", label: "7 days" },
  { value: "14", label: "14 days" },
  { value: "30", label: "30 days" },
] as const;

const SERIES = [
  { key: "booked", label: "Booked", color: CHART.pine },
  { key: "held", label: "On hold", color: CHART.clay },
  { key: "blocked", label: "Blocked", color: CHART.sand },
  { key: "free", label: "Free", color: CHART.mist },
] as const;

type SeriesKey = (typeof SERIES)[number]["key"];

/** Forward-looking unit-nights by status; click a night to open it on the calendar. */
export function OutlookChart({ nights, unitCount }: { nights: OutlookNight[]; unitCount: number }) {
  const router = useRouter();
  const [span, setSpan] = useState<(typeof SPANS)[number]["value"]>("14");
  const [hidden, setHidden] = useState<Set<SeriesKey>>(new Set());
  const shown = nights.slice(0, Number(span));
  const booked = shown.reduce((sum, night) => sum + night.booked, 0);
  const total = shown.length * unitCount;
  const busiest = shown.reduce<OutlookNight | null>((best, night) => (!best || night.booked > best.booked ? night : best), null);
  const quiet = shown.filter((night) => night.booked + night.held === 0).length;

  const toggle = (key: SeriesKey) => setHidden((set) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  return (
    <Card aria-labelledby="outlook-title">
      <CardHeader className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="outlook-title" className="font-display text-xl text-pine">Next {span} days</h2>
          <p className="mt-0.5 text-xs text-ink/50">Unit-nights on the books across {unitCount} active unit{unitCount === 1 ? "" : "s"}. Click a night to open it on the calendar.</p>
        </div>
        <Segmented label="Outlook length" options={SPANS} value={span} onChange={setSpan} />
      </CardHeader>
      <CardBody className="px-2 pb-4 sm:px-4">
        <dl className="mb-4 grid grid-cols-3 gap-2 px-2 sm:max-w-xl">
          <div className="rounded-lg bg-pine-mist/50 px-3 py-2"><dt className="text-[11px] text-ink/55">On the books</dt><dd className="font-display text-xl tabular-nums text-pine">{percent(total ? booked / total : null)}</dd></div>
          <div className="rounded-lg bg-pine-mist/50 px-3 py-2"><dt className="text-[11px] text-ink/55">Busiest night</dt><dd className="truncate font-display text-xl text-pine">{busiest && busiest.booked > 0 ? dayLabel(busiest.date) : "—"}</dd></div>
          <div className="rounded-lg bg-pine-mist/50 px-3 py-2"><dt className="text-[11px] text-ink/55">Empty nights</dt><dd className="font-display text-xl tabular-nums text-pine">{quiet}</dd></div>
        </dl>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={shown}
              margin={{ top: 4, right: 12, bottom: 0, left: 0 }}
              barCategoryGap={Number(span) > 14 ? "18%" : "28%"}
              onClick={(state) => {
                const night = shown[Number(state?.activeTooltipIndex)];
                if (night) router.push(`/calendar?month=${night.date.slice(0, 7)}`);
              }}
              className="cursor-pointer"
            >
              <CartesianGrid vertical={false} stroke={CHART.grid} />
              <XAxis dataKey="date" tickFormatter={(date: string) => (Number(span) > 14 ? dayLabel(date) : weekdayLabel(date).split(",")[0]!)} tick={axisTick} tickLine={false} axisLine={false} minTickGap={8} />
              <YAxis allowDecimals={false} domain={[0, unitCount]} tick={axisTick} tickLine={false} axisLine={false} width={28} />
              <Tooltip
                cursor={{ fill: CHART.pine, fillOpacity: 0.05 }}
                content={({ active, payload }) => {
                  const night = active ? (payload?.[0]?.payload as OutlookNight | undefined) : undefined;
                  return night ? (
                    <TooltipCard
                      title={weekdayLabel(night.date)}
                      rows={SERIES.map((series) => ({ label: series.label, value: `${night[series.key]} unit${night[series.key] === 1 ? "" : "s"}`, color: series.color }))}
                      footer={night.arrivals.length ? <>Arriving: {night.arrivals.join(", ")}</> : "No arrivals"}
                    />
                  ) : null;
                }}
              />
              {SERIES.map((series, index) => hidden.has(series.key) ? null : (
                <Bar animationDuration={450} key={series.key} dataKey={series.key} name={series.label} stackId="units" fill={series.color} radius={index === SERIES.length - 1 ? [4, 4, 0, 0] : 0} stroke="#fbfaf7" strokeWidth={1} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 flex flex-wrap gap-1 px-2">
          {SERIES.map((series) => <LegendToggle key={series.key} label={series.label} color={series.color} active={!hidden.has(series.key)} onClick={() => toggle(series.key)} />)}
        </div>
        <div className="sr-only"><table>
          <caption>Unit-nights by status for the next {span} days</caption>
          <thead><tr><th scope="col">Night</th>{SERIES.map((series) => <th key={series.key} scope="col">{series.label}</th>)}<th scope="col">Arrivals</th></tr></thead>
          <tbody>{shown.map((night) => <tr key={night.date}><th scope="row">{weekdayLabel(night.date)}</th>{SERIES.map((series) => <td key={series.key}>{night[series.key]}</td>)}<td>{night.arrivals.join(", ") || "None"}</td></tr>)}</tbody>
        </table></div>
      </CardBody>
    </Card>
  );
}
