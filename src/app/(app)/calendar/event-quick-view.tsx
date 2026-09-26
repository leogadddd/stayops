"use client";

import Link from "next/link";
import { createContext, useContext, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import { ArrowRight, BrushCleaning, Clock, Mail, MapPin, Phone, UserRound, X } from "lucide-react";
import { buttonClassName } from "@/components/ui/button";
import { PlatformLogo, type PlatformDisplay } from "@/components/app/platform-badge";

export interface EventQuickViewData {
  kindLabel: string;
  tone: "confirmed" | "in-house" | "checked-out" | "hold" | "block";
  title: string;
  /** Short reservation reference, e.g. "#A1B2C3D4". */
  reference?: string;
  unitLabel: string;
  propertyName?: string;
  /** Where the booking came from, and that platform's booking code. */
  platform?: PlatformDisplay;
  platformReference?: string;
  /** "Arrives tomorrow", "Staying now · leaves in 2 days"… */
  timing?: string;
  guest?: { email?: string; phone?: string; href?: string };
  /** Booking money, pre-formatted; absent for people who can't see payments. */
  money?: { total: string; paid: string; balance: string; due: boolean; paidShare: number; depositHeld?: string };
  /** Next steps for this stay, e.g. "Check in". */
  actions?: { label: string; href: string }[];
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
        className="m-auto w-[calc(100%-2rem)] max-w-xl rounded-2xl border border-pine/15 bg-surface p-0 text-ink shadow-2xl backdrop:bg-scrim/40"
      >
        {data ? (
          <div>
            <div className="border-b border-pine/10 p-6 pb-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${TONE[data.tone]}`}>{data.kindLabel}</span>
                  {data.reference ? <span className="font-mono text-xs text-ink/45">{data.reference}</span> : null}
                </div>
                <button type="button" onClick={close} aria-label="Close" className="-m-1 rounded-md p-1 text-ink/50 hover:bg-pine-mist hover:text-ink">
                  <X className="h-5 w-5" aria-hidden />
                </button>
              </div>
              <h2 id="quick-view-title" className="mt-3 break-words font-display text-2xl text-pine">
                {data.guest?.href ? <Link href={data.guest.href} onClick={close} className="underline-offset-4 hover:underline">{data.title}</Link> : data.title}
              </h2>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-ink/60">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-pine/40" aria-hidden />
                <span className="truncate">{data.propertyName ? `${data.propertyName} · ` : ""}{data.unitLabel}</span>
              </p>
              {data.timing ? (
                <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-pine">
                  <Clock className="h-3.5 w-3.5 shrink-0 text-pine/50" aria-hidden />
                  {data.timing}
                </p>
              ) : null}
              {data.platform || data.guest?.email || data.guest?.phone || data.guest?.href ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {data.platform ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-linen px-2.5 py-1 text-xs text-ink/70 ring-1 ring-pine/10">
                      <PlatformLogo platform={data.platform} className="h-4 w-4 rounded" />
                      <span className="font-medium text-pine">{data.platform.name}</span>
                      {data.platformReference ? <span className="font-mono text-ink/50">{data.platformReference}</span> : null}
                    </span>
                  ) : null}
                  {data.guest?.phone ? (
                    <a href={`tel:${data.guest.phone.replace(/\s+/g, "")}`} className="inline-flex items-center gap-1.5 rounded-full bg-linen px-2.5 py-1 text-xs text-pine ring-1 ring-pine/10 hover:bg-pine-mist">
                      <Phone className="h-3.5 w-3.5" aria-hidden />{data.guest.phone}
                    </a>
                  ) : null}
                  {data.guest?.href ? (
                    <Link href={data.guest.href} onClick={close} className="inline-flex items-center gap-1.5 rounded-full bg-linen px-2.5 py-1 text-xs text-pine ring-1 ring-pine/10 hover:bg-pine-mist">
                      <UserRound className="h-3.5 w-3.5" aria-hidden />Guest profile
                    </Link>
                  ) : null}
                  {data.guest?.email ? (
                    <a href={`mailto:${data.guest.email}`} className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-full bg-linen px-2.5 py-1 text-xs text-pine ring-1 ring-pine/10 hover:bg-pine-mist">
                      <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden /><span className="truncate">{data.guest.email}</span>
                    </a>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="space-y-4 p-6 pt-5">
              {data.checkIn || data.checkOut ? (
                <div className="grid grid-cols-2 gap-2">
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
                <dl className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
                  {data.facts.map((fact) => (
                    <div key={fact.label} className="flex gap-1.5">
                      <dt className="text-ink/55">{fact.label}</dt>
                      <dd className="font-medium text-pine">{fact.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}

              {data.money ? (
                <div className="rounded-lg p-3 ring-1 ring-pine/10">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="text-ink/60">Paid <span className="font-medium text-pine">{data.money.paid}</span> of {data.money.total}</span>
                    <span className={data.money.due ? "font-medium text-clay-deep" : "font-medium text-pine"}>{data.money.due ? `${data.money.balance} due` : "Fully paid"}</span>
                  </div>
                  <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-pine/10" aria-hidden>
                    <span className="block h-full rounded-full bg-primary" style={{ width: `${data.money.paidShare * 100}%` }} />
                  </span>
                  {data.money.depositHeld ? <p className="mt-2 text-xs text-ink/55">Deposit held: {data.money.depositHeld}</p> : null}
                </div>
              ) : null}

              {data.turnover ? (
                <p className="flex items-center gap-2 rounded-lg bg-clay-mist/70 px-3 py-2 text-xs text-clay-deep">
                  <BrushCleaning className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {data.turnover}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-pine/10 px-6 py-4 sm:flex-row sm:items-center sm:justify-end">
              {!data.href && !data.actions?.length ? (
                <button type="button" onClick={close} className={buttonClassName("ghost", "md")}>Close</button>
              ) : null}
              {data.actions?.map((action) => (
                <Link key={action.href} href={action.href} onClick={close} className={buttonClassName("outline", "md")}>{action.label}</Link>
              ))}
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
