import type { Metadata } from "next";
import Link from "next/link";
import { PageHeading } from "@/components/app/page-heading";
import { buttonClassName } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { requireMembership } from "@/lib/auth/session";
import { listOrgUnits, listProperties } from "@/server/inventory/service";
import { AvailabilityCheckForm } from "../availability-check-form";

export const metadata: Metadata = { title: "Check availability" };

export default async function AvailabilityPage() {
  const membership = await requireMembership();
  const [properties, units] = await Promise.all([
    listProperties(membership.organizationId),
    listOrgUnits(membership.organizationId),
  ]);
  const propertyNames = new Map(properties.map((property) => [property.id, property.name]));
  const options = units.map((unit) => ({
    id: unit.id,
    name: properties.length > 1 ? `${propertyNames.get(unit.propertyId)} · ${unit.name}` : unit.name,
  }));

  return (
    <div className="mx-auto max-w-3xl overflow-hidden">
      <PageHeading title="Check availability" description="Choose a unit and stay dates. This check is advisory; saving a reservation performs the final conflict check." backHref="/calendar" backLabel="Back to calendar" />
      {options.length ? (
        <AvailabilityCheckForm units={options} />
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
