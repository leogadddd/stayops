import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/session";
import { PageHeading } from "@/components/app/page-heading";
import { PermissionDenied } from "@/components/app/permission-denied";
import { GuestForm } from "../guest-form";

export const metadata: Metadata = { title: "Add guest" };

export default async function NewGuestPage() {
  const membership = await requirePermission("guests.create");
  if (!membership) return <PermissionDenied />;

  return (
    <div className="min-w-0 overflow-hidden">
      <PageHeading title="Add guest" description="Save a guest's details once and pick them on every booking after." backHref="/guests" backLabel="All guests" />
      <GuestForm />
    </div>
  );
}
