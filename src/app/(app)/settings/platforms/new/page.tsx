import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/session";
import { PageHeading } from "@/components/app/page-heading";
import { PermissionDenied } from "@/components/app/permission-denied";
import { Card, CardBody } from "@/components/ui/card";
import { createPlatformAction } from "../actions";
import { PlatformForm } from "../platform-forms";

export const metadata: Metadata = { title: "Add booking platform" };

export default async function NewPlatformPage() {
  const membership = await requirePermission("platforms.create");
  if (!membership) return <PermissionDenied />;
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeading title="Add booking platform" description="A channel your bookings come from, like TikTok or a travel agent. It's added to the end of the reservation form's list." backHref="/settings/platforms" backLabel="Booking platforms" />
      <Card className="bg-card">
        <CardBody>
          <PlatformForm
            action={createPlatformAction}
            submitLabel="Add platform"
            successMessage="Platform added."
            values={{ name: "", color: "", websiteUrl: "", commissionPercent: "", collectsPayment: false, logoUrl: null }}
          />
        </CardBody>
      </Card>
    </div>
  );
}
