import Link from "next/link";
import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { requireOwner } from "@/lib/auth/session";
import { PermissionDenied } from "@/components/app/permission-denied";
import { PageHeading } from "@/components/app/page-heading";
import { listProperties } from "@/server/inventory/service";
import { buttonClassName } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TableActionsMenu } from "@/components/ui/table-actions-menu";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { deletePropertyAction } from "./actions";

export const metadata: Metadata = { title: "Properties" };

export default async function PropertiesPage() {
  const membership = await requireOwner();
  if (!membership) return <PermissionDenied />;

  const properties = await listProperties(membership.organizationId);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeading title="Properties & units" description="Where your stays happen. Manage each property and the bookable spaces inside it.">
        <Link href="/properties/new" className={buttonClassName("clay")}><Plus className="h-4 w-4" aria-hidden />Add property</Link>
      </PageHeading>
      <Card className="overflow-hidden bg-[#FFFDFA]">
        <Table aria-label="Properties">
          <TableHeader><TableRow><TableHead>Property</TableHead><TableHead>Timezone</TableHead><TableHead>Arrival default</TableHead><TableHead>Departure default</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {properties.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="py-12 text-center"><p className="font-medium text-pine">No properties yet</p><p className="mt-1 text-ink/55">Add your first property, then the units guests can book.</p></TableCell></TableRow>
            ) : properties.map((property) => (
              <TableRow key={property.id}>
                <TableCell><Link href={`/properties/${property.id}`} className="font-medium text-pine underline-offset-4 hover:underline">{property.name}</Link></TableCell>
                <TableCell>{property.timezone}</TableCell>
                <TableCell>{property.checkInTime}</TableCell>
                <TableCell>{property.checkOutTime}</TableCell>
                <TableCell className="text-right">
                  <TableActionsMenu
                    label={property.name}
                    viewHref={`/properties/${property.id}`}
                    editHref={`/properties/${property.id}/edit`}
                    deleteLabel={`Delete ${property.name}?`}
                    deleteDescription="The property and its units will disappear from active inventory, but reservation, payment, expense, and audit history will be preserved. Properties with an active hold or stay cannot be deleted."
                    onDelete={deletePropertyAction.bind(null, property.id)}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
