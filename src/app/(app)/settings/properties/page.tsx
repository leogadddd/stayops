import Link from "next/link";
import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { requireMembership } from "@/lib/auth/session";
import { listProperties } from "@/server/inventory/service";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PropertyForm } from "./property-form";

export const metadata: Metadata = { title: "Properties" };

export default async function PropertiesPage() {
  const membership = await requireMembership();
  const properties = await listProperties(membership.organizationId);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-3xl text-pine">Properties & units</h1>
      <p className="mt-1 text-sm text-ink/60">
        Where your stays happen. Add a property, then the units inside it.
      </p>

      {properties.length === 0 ? (
        <EmptyState
          className="mt-8"
          title="No properties yet"
          description="Add your first property — an apartment, a house, a building — then add the units guests can book."
        />
      ) : (
        <ul className="mt-8 space-y-3">
          {properties.map((property) => (
            <li key={property.id}>
              <Link
                href={`/settings/properties/${property.id}`}
                className="block rounded-2xl border border-pine/10 bg-white px-5 py-4 shadow-[0_1px_2px_rgba(32,58,53,0.06)] transition-colors hover:border-pine/30"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-pine">
                      {property.name}
                    </p>
                    <p className="mt-0.5 text-sm text-ink/55">
                      {property.timezone} · check-in {property.checkInTime} ·
                      check-out {property.checkOutTime}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm text-pine/70">
                    Manage →
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Card className="mt-10">
        <CardHeader>
          <h2 className="font-display text-xl text-pine">Add a property</h2>
        </CardHeader>
        <CardBody>
          <PropertyForm />
        </CardBody>
      </Card>

      {properties.length === 0 ? null : (
        <p className="mt-6 flex items-center gap-2 text-sm text-ink/55">
          <Plus className="h-4 w-4" aria-hidden />
          More properties can be added any time; each keeps its own timezone
          and house rules.
        </p>
      )}
    </div>
  );
}
