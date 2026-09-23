import type { ReactNode } from "react";
import { requireOwner } from "@/lib/auth/session";
import { PermissionDenied } from "@/components/app/permission-denied";

export default async function SettingsLayout({
  children,
}: {
  children: ReactNode;
}) {
  const membership = await requireOwner();
  if (!membership) {
    return (
      <PermissionDenied description="Settings pages are limited to the organization owner. Staff members can use the calendar, reservations, guests and tasks pages." />
    );
  }
  return <>{children}</>;
}
