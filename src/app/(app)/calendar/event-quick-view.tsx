"use client";

import Link from "next/link";
import { createContext, useContext, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import { ArrowRight, BrushCleaning, X } from "lucide-react";
import { buttonClassName } from "@/components/ui/button";

export interface EventQuickViewData {
  kindLabel: string;
  tone: "confirmed" | "in-house" | "checked-out" | "hold" | "block";
  title: string;
  unitLabel: string;
  checkIn?: { date: string; time: string };
  checkOut?: { date: string; time: string; actual: boolean; expected?: string };
  facts: { label: string; value: string }[];
  turnover?: string;
  href?: string;
  hrefLabel?: string;
}

const TONE: Record<EventQuickViewData["tone"], string> = {
  confirmed: "bg-stay-booked text-pine-deep",
  "in-house": "bg-primary text-white",
  "checked-out": "bg-stay-departed text-pine-soft",
  hold: "border border-dashed border-stay-hold-line bg-stay-hold text-stay-hold-ink",
  block: "bg-stay-blocked text-stay-blocked-ink",
};

const QuickViewContext = createContext<(data: EventQuickViewData) => void>(() => {});

/** Hosts the single quick-view dialog shared by every event on the calendar. */
export function QuickViewProvider({ children }: { children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [data, setData] = useState<EventQuickViewData | null>(null);

  const open = (next: EventQuickViewData) => {
    setData(next);
    dialog.current?.showModal();
  };
  const close = () => dialog.current?.close();

  return (
    <QuickViewContext.Provider value={open}>
      {children}
      <dialog
        ref={dialog}
        aria-labelledby="quick-view-title"
        onClick={(event) => { if (event.target === dialog.current) close(); }}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl bg-paper p-0 text-ink shadow-2xl backdrop:bg-scrim/40"
      >
        {data ? (
          <div className="p-6">
            <div className="flex items-start justify-between gap-3">
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${TONE[data.tone]}`}>{data.kindLabel}</span>
              <button type="button" onClick={close} aria-label="Close" className="-m-1 rounded-md p-1 text-ink/50 hover:bg-pine-mist hover:text-ink">
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <h2 id="quick-view-title" className="mt-3 break-words font-display text-2xl text-pine">{data.title}</h2>
            <p className="mt-0.5 text-sm text-ink/60">{data.unitLabel}</p>

            {data.checkIn || data.checkOut ? (
              <div className="mt-5 grid grid-cols-2 gap-2">
                {data.checkIn ? (
                  <div className="rounded-lg bg-linen p-3 ring-1 ring-pine/10">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-ink/50">Check-in</p>
                    <p className="mt-1 text-sm font-medium">{data.checkIn.date}</p>
                    <p className="text-sm text-ink/70">{data.checkIn.time}</p>
                  </div>
                ) : null}
                {data.checkOut ? (
                  <div className="rounded-lg bg-linen p-3 ring-1 ring-pine/10">
                    <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-ink/50">
                      Check-out
                      {data.checkOut.actual ? <span className="rounded-full bg-pine-mist px-1.5 py-px text-[10px] normal-case tracking-normal text-pine">Actual</span> : null}
                    </p>
                    <p className="mt-1 text-sm font-medium">{data.checkOut.date}</p>
                    <p className="text-sm text-ink/70">{data.checkOut.time}</p>
                    {data.checkOut.expected ? <p className="mt-1 text-[11px] text-ink/45">Expected {data.checkOut.expected}</p> : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            {data.facts.length ? (
              <dl className="mt-4 divide-y divide-pine/10 text-sm">
                {data.facts.map((fact) => (
                  <div key={fact.label} className="flex justify-between gap-4 py-2">
                    <dt className="text-ink/60">{fact.label}</dt>
                    <dd className="text-right font-medium">{fact.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}

            {data.turnover ? (
              <p className="mt-3 flex items-center gap-2 rounded-lg bg-clay-mist/70 px-3 py-2 text-xs text-clay-deep">
                <BrushCleaning className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {data.turnover}
              </p>
            ) : null}

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={close} className={buttonClassName("ghost", "md")}>Close</button>
              {data.href ? (
                <Link href={data.href} onClick={close} className={buttonClassName("primary", "md")}>
                  {data.hrefLabel ?? "View reservation"}<ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}
      </dialog>
    </QuickViewContext.Provider>
  );
}

/**
 * A calendar event that opens the quick view. With an href it stays a real
 * link, so modifier-clicks and middle-clicks still open the page directly.
 */
export function EventTrigger({ quickView, href, className, style, children, ...aria }: {
  quickView: EventQuickViewData;
  href?: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
  "aria-label"?: string;
  title?: string;
}) {
  const open = useContext(QuickViewContext);
  const onClick = (event: MouseEvent) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    open(quickView);
  };
  return href ? (
    <Link href={href} onClick={onClick} className={className} style={style} {...aria}>{children}</Link>
  ) : (
    <button type="button" onClick={onClick} className={`text-left ${className ?? ""}`} style={style} {...aria}>{children}</button>
  );
}
