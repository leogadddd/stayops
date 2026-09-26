import type { ReactNode } from "react";
import { requireMembership } from "@/lib/auth/session";
import { resolvePermissions } from "@/lib/permissions";
import { PageHeading } from "@/components/app/page-heading";
import { SettingsNavigation } from "./settings-navigation";

export default async function SettingsLayout({
  children,
}: {
  children: ReactNode;
}) {
  const membership = await requireMembership();
  return (
    <div className="min-w-0">
      <PageHeading title="Settings" description="Manage your personal preferences and, where allowed, organization settings." />
      <div className="lg:grid lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-8">
        <aside className="mb-6 lg:mb-0 lg:min-h-[calc(100dvh-13rem)] lg:self-stretch lg:pr-5">
          <SettingsNavigation role={membership.role} permissions={membership.permissions ?? resolvePermissions(membership.role)} />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
