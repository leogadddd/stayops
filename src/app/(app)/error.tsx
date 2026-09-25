"use client";

import { RouteError } from "@/components/app/route-error";

/** Keeps the sidebar and header on screen when an app page fails to render. */
export default function AppError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError {...props} />;
}
