import type { Metadata } from "next";
import { requireOwner } from "@/lib/auth/session";
import { todayInTimeZone } from "@/lib/dates";
import { listOrgUnits, listProperties } from "@/server/inventory/service";
import { PageHeading } from "@/components/app/page-heading";
import { PermissionDenied } from "@/components/app/permission-denied";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ExpenseForm } from "../expense-form";

export const metadata: Metadata = { title: "Record expense" };

export default async function NewExpensePage() {
  const membership = await requireOwner();
  if (!membership) return <PermissionDenied description="Only the organization owner can record expenses." />;

  const [properties, units] = await Promise.all([
    listProperties(membership.organizationId),
    listOrgUnits(membership.organizationId),
  ]);
  const unitsByProperty: Record<string, { id: string; name: string }[]> = {};
  for (const unit of units) {
    (unitsByProperty[unit.propertyId] ??= []).push({ id: unit.id, name: unit.name });
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeading title="Record expense" description="Keep operating costs and capital spending organized by property." backHref="/expenses" backLabel="Back to expenses" />
      {properties.length === 0 ? (
        <EmptyState title="Add a property first" description="Expenses need a property. Set up a property in Settings before recording spending." />
      ) : (
        <Card><CardBody>
          <ExpenseForm properties={properties.map(({ id, name }) => ({ id, name }))} unitsByProperty={unitsByProperty} defaultPaidDate={todayInTimeZone("Asia/Manila")} />
        </CardBody></Card>
      )}
    </div>
  );
}
