import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireOwner } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { organizations } from "@/lib/db/schema";
import { PageHeading } from "@/components/app/page-heading";
import { PermissionDenied } from "@/components/app/permission-denied";
import { Card, CardBody } from "@/components/ui/card";
import { PaymentInstructionsForm } from "../../payment-instructions-form";

export const metadata: Metadata = { title: "Edit payment instructions" };

export default async function EditPaymentInstructionsPage() {
  const membership = await requireOwner();
  if (!membership) return <PermissionDenied />;

  const org = await db.query.organizations.findFirst({ where: eq(organizations.id, membership.organizationId) });
  if (!org) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeading title="Edit payment instructions" description="Tell guests how to pay on their private booking page." backHref="/settings" backLabel="Settings" />
      <Card className="bg-[#FFFDFA]"><CardBody><PaymentInstructionsForm defaultValue={org.paymentInstructions ?? ""} /></CardBody></Card>
    </div>
  );
}
