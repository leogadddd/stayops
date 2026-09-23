import type { Metadata } from "next";
import { requireOwner } from "@/lib/auth/session";
import { PageHeading } from "@/components/app/page-heading";
import { PermissionDenied } from "@/components/app/permission-denied";
import { Card, CardBody } from "@/components/ui/card";
import { PropertyForm } from "../property-form";

export const metadata: Metadata = { title: "Add property" };

export default async function NewPropertyPage() {
  const membership = await requireOwner();
  if (!membership) return <PermissionDenied />;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeading title="Add property" description="Set up a property, then add its bookable units." backHref="/settings/properties" backLabel="All properties" />
      <Card className="bg-[#FFFDFA]"><CardBody><PropertyForm /></CardBody></Card>
    </div>
  );
}
