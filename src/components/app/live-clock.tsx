"use client";

import { useEffect, useState } from "react";

const DATE = new Intl.DateTimeFormat("en-PH", {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "Asia/Manila",
});
const TIME = new Intl.DateTimeFormat("en-PH", {
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
  timeZone: "Asia/Manila",
});

export function LiveClock({ initialNow }: { initialNow: string }) {
  const [now, setNow] = useState(() => new Date(initialNow));

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="hidden border-l border-pine/15 pl-5 text-right lg:block" aria-label="Current date and time">
      <p className="text-xs text-ink/65">{DATE.format(now)}</p>
      <time dateTime={now.toISOString()} className="mt-1 block text-xs font-medium tabular-nums text-pine">{TIME.format(now)}</time>
    </div>
  );
}
