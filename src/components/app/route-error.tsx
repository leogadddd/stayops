"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/**
 * Shared body for route error boundaries. A failed query while rendering a
 * page lands here instead of taking down the whole app; "Try again" re-runs
 * the server render for the segment.
 */
export function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  const [retrying, startRetry] = useTransition();

  useEffect(() => {
    console.error(error);
    toast.error("This page couldn’t load", {
      id: "route-error",
      description: "Something went wrong while loading your data.",
    });
  }, [error]);

  // In production Next.js replaces server error messages with a generic one,
  // so the raw message is only useful while developing.
  const detail = process.env.NODE_ENV === "development" ? error.message : null;

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center rounded-2xl border border-dashed border-pine/25 bg-surface/60 px-6 py-16 text-center">
      <h2 className="font-display text-2xl text-pine">This page couldn’t load</h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-ink/60">
        Something went wrong while loading your data. Your work is safe — try
        again in a moment.
      </p>
      {detail && (
        <pre className="mt-4 max-w-full overflow-x-auto whitespace-pre-wrap rounded-lg bg-clay/10 px-3 py-2 text-left text-xs text-clay-deep">
          {detail}
        </pre>
      )}
      {error.digest && (
        <p className="mt-3 text-xs text-ink/40">Reference: {error.digest}</p>
      )}
      <div className="mt-6 flex gap-3">
        <Button
          type="button"
          disabled={retrying}
          onClick={() =>
            startRetry(() => {
              router.refresh();
              reset();
            })
          }
        >
          {retrying ? "Retrying…" : "Try again"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.push("/dashboard")}>
          Go to dashboard
        </Button>
      </div>
    </div>
  );
}
