import { cn } from "@/lib/utils";

/**
 * Loading placeholders shaped like the real pages, so the layout doesn't jump
 * when the page streams in. Widths and grids mirror the page markup; keep them
 * in step when a page's layout changes.
 */

export function Bone({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div aria-hidden className={cn("animate-pulse rounded-md bg-pine/10", className)} style={style} />;
}

const panel = "rounded-2xl border border-pine/10 bg-surface shadow-[0_1px_2px_rgba(32,58,53,0.06)]";

/** Mirrors `PageHeading`. */
function Heading({ back = false, action = false, description = true }: { back?: boolean; action?: boolean; description?: boolean }) {
  return (
    <div className="mb-6">
      {back ? <Bone className="mb-4 h-5 w-32" /> : null}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <Bone className="h-9 w-56 sm:h-10" />
          {description ? <Bone className="mt-2 h-4 w-80 max-w-full" /> : null}
        </div>
        {action ? <Bone className="h-10 w-40 rounded-lg" /> : null}
      </div>
    </div>
  );
}

function FilterBar({ fields = 2, className }: { fields?: number; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-end gap-3 p-4", panel, className)}>
      {Array.from({ length: fields }, (_, index) => (
        <div key={index} className={index === 0 ? "min-w-48 flex-1" : "w-full sm:w-48"}>
          <Bone className="h-4 w-20" />
          <Bone className="mt-1.5 h-10 w-full rounded-lg" />
        </div>
      ))}
      <Bone className="h-10 w-20 rounded-lg" />
    </div>
  );
}

function TableRows({ rows = 8, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("overflow-hidden", panel, className)}>
      <div className="flex gap-6 border-b border-pine/10 px-4 py-3">
        {[16, 24, 20, 16, 20].map((width, index) => <Bone key={index} className="h-3" style={{ width: `${width * 4}px` }} />)}
      </div>
      <div className="divide-y divide-pine/8">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="flex items-center gap-6 px-4 py-4">
            <Bone className="h-4 w-1/5" />
            <Bone className="h-4 w-1/4" />
            <Bone className="h-5 w-20 rounded-full" />
            <Bone className="ml-auto h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

function Frame({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("min-w-0 overflow-hidden", className)} aria-busy="true" aria-label="Loading page">
      {children}
      <p className="sr-only">Loading page content</p>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <Frame className="mx-auto max-w-[1600px] pb-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
        <div>
          <Bone className="h-9 w-72 max-w-full sm:h-12" />
          <Bone className="mt-1.5 h-4 w-96 max-w-full" />
        </div>
        <div className="flex gap-2">
          <Bone className="h-10 w-40 rounded-lg" />
          <Bone className="h-10 w-40 rounded-lg" />
        </div>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="rounded-xl border border-pine/12 bg-linen p-4 sm:p-5">
            <div className="flex items-center gap-4">
              <Bone className="h-11 w-11 shrink-0 rounded-full" />
              <div className="flex-1">
                <Bone className="h-3 w-20" />
                <Bone className="mt-2 h-7 w-12" />
              </div>
            </div>
            <Bone className="mt-3 h-3 w-full" />
          </div>
        ))}
      </div>
      <div className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[minmax(20rem,0.75fr)_minmax(0,1.25fr)]">
        {[4, 6].map((rows, index) => (
          <div key={index} className="rounded-xl border border-pine/12 bg-linen">
            <div className="border-b border-pine/10 px-6 py-4">
              <Bone className="h-6 w-40" />
              <Bone className="mt-2 h-3 w-56" />
            </div>
            <div className="space-y-4 px-6 py-5">
              {Array.from({ length: rows }, (_, row) => <Bone key={row} className="h-10 w-full" />)}
            </div>
          </div>
        ))}
      </div>
    </Frame>
  );
}

export function CalendarSkeleton() {
  return (
    <Frame className="mx-auto max-w-[1600px]">
      <Heading action description={false} />
      <div className="mb-5 flex gap-3 overflow-hidden">
        {Array.from({ length: 5 }, (_, index) => <Bone key={index} className="h-14 w-48 shrink-0 rounded-xl" />)}
      </div>
      <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_19rem] 2xl:grid-cols-[minmax(0,1fr)_21rem]">
        <div className={cn("p-4", panel)}>
          <div className="mb-4 flex items-center justify-between">
            <Bone className="h-7 w-40" />
            <Bone className="h-9 w-48 rounded-lg" />
          </div>
          <div className="grid grid-cols-7 gap-px">
            {Array.from({ length: 35 }, (_, index) => <Bone key={index} className="h-20 rounded-none sm:h-24" />)}
          </div>
        </div>
        <div className={cn("space-y-3 p-5", panel)}>
          <Bone className="h-5 w-32" />
          {Array.from({ length: 4 }, (_, index) => <Bone key={index} className="h-14 w-full" />)}
        </div>
      </div>
    </Frame>
  );
}

export function AvailabilitySkeleton() {
  return (
    <Frame>
      <Heading back />
      <div className={cn("flex flex-wrap items-end gap-4 p-5", panel)}>
        {[0, 1, 2].map((index) => (
          <div key={index} className="min-w-44 flex-1">
            <Bone className="h-4 w-20" />
            <Bone className="mt-1.5 h-12 w-full rounded-lg" />
          </div>
        ))}
        <Bone className="h-12 w-36 rounded-lg" />
      </div>
    </Frame>
  );
}

/** Heading, filters, then a table: reservations, guests, expenses, tasks, audit logs. */
export function TableListSkeleton({ className, pills = false, filters = 2 }: { className?: string; pills?: boolean; filters?: number }) {
  return (
    <Frame className={className}>
      <Heading action />
      {pills ? (
        <div className="mb-4 flex flex-wrap gap-2">
          {Array.from({ length: 6 }, (_, index) => <Bone key={index} className="h-8 w-24 rounded-full" />)}
        </div>
      ) : null}
      <FilterBar fields={filters} />
      <TableRows className="mt-4" />
    </Frame>
  );
}

export function CardGridSkeleton() {
  return (
    <Frame>
      <Heading action />
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className={cn("overflow-hidden", panel)}>
            <Bone className="aspect-[16/9] rounded-none" />
            <div className="p-5">
              <Bone className="h-6 w-40" />
              <Bone className="mt-2 h-4 w-56 max-w-full" />
              <div className="mt-5 grid grid-cols-3 gap-3">
                {[0, 1, 2].map((stat) => <Bone key={stat} className="h-10" />)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Frame>
  );
}

/** Photo hero plus a main column and a side panel: reservation, property and unit pages. */
export function DetailSkeleton() {
  return (
    <Frame>
      <Bone className="mb-4 h-5 w-32" />
      <div className={cn("overflow-hidden", panel)}>
        <div className="grid md:grid-cols-[16rem_minmax(0,1fr)] xl:grid-cols-[20rem_minmax(0,1fr)]">
          <Bone className="aspect-[16/9] rounded-none md:aspect-auto md:h-full md:min-h-56" />
          <div className="flex min-w-0 flex-col gap-5 p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <Bone className="h-5 w-24 rounded-full" />
                <Bone className="mt-3 h-9 w-64 max-w-full sm:h-10" />
                <Bone className="mt-1.5 h-4 w-48" />
              </div>
              <div className="flex gap-2">
                <Bone className="h-10 w-28 rounded-lg" />
                <Bone className="h-10 w-24 rounded-lg" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {Array.from({ length: 3 }, (_, index) => <Bone key={index} className="h-16 rounded-xl" />)}
            </div>
          </div>
        </div>
      </div>
      <div className="mt-6 grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0 space-y-6">
          {[3, 4].map((rows, index) => (
            <div key={index} className={cn("p-5 sm:p-6", panel)}>
              <Bone className="h-6 w-36" />
              <div className="mt-5 space-y-3">
                {Array.from({ length: rows }, (_, row) => <Bone key={row} className="h-10 w-full" />)}
              </div>
            </div>
          ))}
        </div>
        <div className={cn("space-y-3 p-5", panel)}>
          <Bone className="h-6 w-28" />
          {Array.from({ length: 4 }, (_, index) => <Bone key={index} className="h-5 w-full" />)}
        </div>
      </div>
    </Frame>
  );
}

/** Form with a sticky preview aside: new/edit reservation, property and unit. */
export function WideFormSkeleton() {
  return (
    <Frame>
      <Heading back />
      <div className="grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0 space-y-6">
          {[4, 3].map((fields, index) => (
            <div key={index} className={cn("p-5 sm:p-6", panel)}>
              <Bone className="h-6 w-40" />
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {Array.from({ length: fields }, (_, field) => (
                  <div key={field}>
                    <Bone className="h-4 w-24" />
                    <Bone className="mt-1.5 h-10 w-full rounded-lg" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className={cn("overflow-hidden", panel)}>
          <Bone className="aspect-[16/10] rounded-none" />
          <div className="space-y-3 p-5">
            <Bone className="h-7 w-40" />
            <Bone className="h-4 w-48" />
            <Bone className="mt-4 h-11 w-full rounded-lg" />
          </div>
        </div>
      </div>
    </Frame>
  );
}

/** A single card form under a heading: reservation actions, expense and task forms. */
export function NarrowFormSkeleton() {
  return (
    <Frame className="mx-auto max-w-2xl">
      <Heading back />
      <div className="rounded-xl border border-pine/12 bg-surface px-6 py-5">
        <div className="space-y-5">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index}>
              <Bone className="h-4 w-28" />
              <Bone className="mt-1.5 h-10 w-full rounded-lg" />
            </div>
          ))}
        </div>
        <Bone className="mt-6 h-10 w-36 rounded-lg" />
      </div>
    </Frame>
  );
}

export function ReportsSkeleton() {
  return (
    <Frame className="mx-auto max-w-5xl">
      <Bone className="h-9 w-40" />
      <Bone className="mt-2 h-4 w-80 max-w-full" />
      <div className="mt-5 flex flex-wrap items-end gap-3">
        {[44, 56, 56].map((width, index) => (
          <div key={index}>
            <Bone className="h-4 w-16" />
            <Bone className="mt-1.5 h-10 rounded-lg" style={{ width: `${width * 4}px` }} />
          </div>
        ))}
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="rounded-xl border border-pine/12 bg-linen p-5">
            <Bone className="h-3 w-24" />
            <Bone className="mt-3 h-7 w-20" />
          </div>
        ))}
      </div>
      <TableRows className="mt-6" rows={6} />
    </Frame>
  );
}

/** Mirrors the settings layout: heading, side navigation, content card. */
export function SettingsSkeleton() {
  return (
    <Frame>
      <Heading />
      <div className="lg:grid lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-8">
        <div className="mb-6 space-y-2 lg:mb-0 lg:pr-5">
          {Array.from({ length: 6 }, (_, index) => <Bone key={index} className="h-10 w-full rounded-lg" />)}
        </div>
        <div className="rounded-xl border border-pine/12 bg-linen px-6 py-5">
          <Bone className="h-6 w-40" />
          <div className="mt-5 space-y-5">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index}>
                <Bone className="h-4 w-28" />
                <Bone className="mt-1.5 h-10 w-full rounded-lg" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </Frame>
  );
}

/** Fallback for pages without a dedicated shape. */
export function GenericPageSkeleton() {
  return (
    <Frame className="mx-auto max-w-5xl">
      <Heading />
      <div className="rounded-xl border border-pine/12 bg-linen p-5">
        <Bone className="h-4 w-32" />
        <div className="mt-5 space-y-4">
          {Array.from({ length: 4 }, (_, index) => <Bone key={index} className="h-10 w-full" />)}
        </div>
      </div>
    </Frame>
  );
}
