import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/session";
import { getTaskDetail } from "@/server/operations/service";
import { PageHeading } from "@/components/app/page-heading";
import { PermissionDenied } from "@/components/app/permission-denied";
import { Card, CardBody } from "@/components/ui/card";
import { ResolveDamageForm } from "../../../resolve-damage-form";

export const metadata: Metadata = { title: "Resolve damage" };

export default async function ResolveTaskDamagePage({ params }: {
  params: Promise<{ id: string; damageReportId: string }>;
}) {
  const membership = await requirePermission("damage.update");
  if (!membership) return <PermissionDenied description="Only the organization owner can resolve damage reports." />;

  const { id, damageReportId } = await params;
  const { task, unitName, propertyName, openDamage } = await getTaskDetail(membership.organizationId, id);
  // getTaskDetail scopes open reports to the task's unit and organization.
  const report = openDamage.find((damage) => damage.id === damageReportId);
  if (!report) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeading title="Resolve damage" description={`${propertyName} · ${unitName}`} backHref={`/tasks/${task.id}`} backLabel="Back to task" />
      <Card><CardBody className="space-y-5">
        <p className="whitespace-pre-line rounded-lg bg-sage/35 p-4 text-sm text-pine">{report.description}</p>
        <ResolveDamageForm taskId={task.id} damageReportId={report.id} />
      </CardBody></Card>
    </div>
  );
}
