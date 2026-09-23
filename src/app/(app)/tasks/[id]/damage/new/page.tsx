import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireMembership } from "@/lib/auth/session";
import { getTaskDetail } from "@/server/operations/service";
import { PageHeading } from "@/components/app/page-heading";
import { Card, CardBody } from "@/components/ui/card";
import { DamageReportForm } from "../../../damage-report-form";

export const metadata: Metadata = { title: "Report turnover damage" };

export default async function NewTaskDamagePage({ params }: { params: Promise<{ id: string }> }) {
  const membership = await requireMembership();
  const { id } = await params;
  const { task, unitName, propertyName } = await getTaskDetail(membership.organizationId, id);
  if (task.status !== "open") redirect(`/tasks/${task.id}`);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeading title="Report damage" description={`${propertyName} · ${unitName}. This report stays open until the owner resolves it.`} backHref={`/tasks/${task.id}`} backLabel="Back to task" />
      <Card><CardBody><DamageReportForm unitId={task.unitId} returnHref={`/tasks/${task.id}`} /></CardBody></Card>
    </div>
  );
}
