import type { Metadata } from "next";
import Link from "next/link";
import { PageHeading } from "@/components/app/page-heading";
import { buttonClassName } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { requireMembership } from "@/lib/auth/session";
import { listOrgUnits } from "@/server/inventory/service";
import { AvailabilityCheckForm } from "../availability-check-form";

export const metadata: Metadata = { title: "Check availability" };

export default async function AvailabilityPage() {
  const membership = await requireMembership();
  const units = await listOrgUnits(membership.organizationId);

  return (
    <div className="mx-auto max-w-3xl overflow-hidden">
      <PageHeading title="Check availability" description="Search active units by stay dates and guest count. Saving a reservation performs the final conflict check." backHref="/calendar" backLabel="Back to calendar" />
      {units.length ? (
        <AvailabilityCheckForm />
      ) : (
        <EmptyState
          title="No units to check"
          description={membership.role === "owner" ? "Add a property and unit before checking stay dates." : "Ask the owner to add a property and unit."}
          action={membership.role === "owner" ? <Link href="/settings/properties" className={buttonClassName("clay", "md")}>Manage properties</Link> : undefined}
        />
      )}
    </div>
  );
}
