function Bar({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-md bg-pine/10 ${className}`} />;
}

/**
 * Shown immediately during an App Router navigation while dynamic,
 * authenticated page data is being rendered on the server.
 */
export default function AppLoading() {
  return (
    <div className="mx-auto max-w-6xl" aria-busy="true" aria-label="Loading page">
      <Bar className="h-8 w-44" />
      <Bar className="mt-3 h-4 w-80 max-w-full" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div key={item} className="rounded-xl border border-pine/12 bg-linen p-5">
            <Bar className="h-4 w-24" />
            <Bar className="mt-4 h-7 w-16" />
            <Bar className="mt-3 h-3 w-full" />
          </div>
        ))}
      </div>
      <div className="mt-6 rounded-xl border border-pine/12 bg-linen p-5">
        <Bar className="h-4 w-32" />
        <div className="mt-5 space-y-4">
          {[0, 1, 2, 3].map((item) => <Bar key={item} className="h-10 w-full" />)}
        </div>
      </div>
      <p className="sr-only">Loading page content</p>
    </div>
  );
}
