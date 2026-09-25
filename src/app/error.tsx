"use client";

import { RouteError } from "@/components/app/route-error";

/** Fallback for routes outside the app shell (onboarding, guest links). */
export default function RootError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-6">
      <RouteError {...props} />
    </main>
  );
}
