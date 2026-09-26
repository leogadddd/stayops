"use client";

import Link from "next/link";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { PlatformLogo } from "@/components/app/platform-badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";

export type PlatformBreakdownRow = {
  platformId: string | null;
  name: string;
  logoUrl: string | null;
  color: string | null;
  reservationCount: number;
};

const FALLBACK_COLORS = ["#315d50", "#c4674d", "#7a9b78", "#caa66b", "#718096", "#9a6b94"];

export function PlatformBreakdown({ monthLabel, platforms, className }: { monthLabel: string; platforms: PlatformBreakdownRow[] | null; className?: string }) {
  const rows = platforms ?? [];
  const total = rows.reduce((sum, platform) => sum + platform.reservationCount, 0);
  const chartData = rows.map((platform, index) => ({
    ...platform,
    color: platform.color ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length]!,
  }));

  return (
    <Card className={className}>
      <CardHeader className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-xl text-pine">Booking sources</h2>
          <p className="mt-1 text-xs text-ink/50">Reservations checking in during {monthLabel}.</p>
        </div>
        <Link href="/reservations" className="text-xs font-medium text-clay-deep hover:underline">View reservations</Link>
      </CardHeader>
      <CardBody>
        {chartData.length ? (
          <div className="grid items-center gap-5 md:grid-cols-[13rem_minmax(0,1fr)]">
            <div className="relative mx-auto h-52 w-52" aria-label={`Booking sources pie chart with ${total} reservations`}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={chartData} dataKey="reservationCount" nameKey="name" innerRadius="62%" outerRadius="88%" paddingAngle={2} stroke="none" isAnimationActive={false}>
                    {chartData.map((platform) => <Cell key={platform.platformId ?? "not-recorded"} fill={platform.color} />)}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      const platform = active ? payload?.[0]?.payload as (typeof chartData)[number] | undefined : undefined;
                      return platform ? (
                        <div className="rounded-lg border border-pine/15 bg-surface px-3 py-2 text-xs shadow-lg">
                          <p className="font-semibold text-pine">{platform.name}</p>
                          <p className="mt-0.5 text-ink/60">{platform.reservationCount} {platform.reservationCount === 1 ? "reservation" : "reservations"}</p>
                        </div>
                      ) : null;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="font-display text-3xl leading-none text-pine">{total}</span>
                <span className="mt-1 text-[10px] font-medium uppercase tracking-wider text-ink/50">Bookings</span>
              </div>
            </div>
            <ul className="grid gap-1 sm:grid-cols-2">
              {chartData.map((platform) => {
                const share = total ? Math.round((platform.reservationCount / total) * 100) : 0;
                return (
                  <li key={platform.platformId ?? "not-recorded"}>
                    <Link href={platform.platformId ? `/reservations?platform=${platform.platformId}` : "/reservations"} className="flex items-center gap-2 rounded-lg px-2 py-2 transition hover:bg-pine-mist/60">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: platform.color }} aria-hidden />
                      <PlatformLogo platform={platform} className="h-4 w-4 rounded" />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-pine">{platform.name}</span>
                      <span className="shrink-0 text-xs tabular-nums text-ink/55">{platform.reservationCount} · {share}%</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : <p className="text-sm text-ink/55">No reservations are checking in this month yet.</p>}
        <table className="sr-only">
          <caption>Booking sources for {monthLabel}</caption>
          <thead><tr><th scope="col">Platform</th><th scope="col">Reservations</th></tr></thead>
          <tbody>{chartData.map((platform) => <tr key={platform.platformId ?? "not-recorded"}><th scope="row">{platform.name}</th><td>{platform.reservationCount}</td></tr>)}</tbody>
        </table>
      </CardBody>
    </Card>
  );
}
