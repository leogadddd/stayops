import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireMembership } from "@/lib/auth/session";
import { getTaskDetail } from "@/server/operations/service";
import { PageHeading } from "@/components/app/page-heading";
import { Card, CardBody } from "@/components/ui/card";
import { TaskNotesForm } from "../task-notes-form";

export const metadata: Metadata = { title: "Edit turnover notes" };

export default async function EditTaskPage({ params }: { params: Promise<{ id: string }> }) {
  const membership = await requireMembership();
  const { id } = await params;
  const { task, unitName, propertyName } = await getTaskDetail(membership.organizationId, id);
  if (task.status !== "open") redirect(`/tasks/${task.id}`);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeading title="Edit turnover notes" description={`${propertyName} · ${unitName}`} backHref={`/tasks/${task.id}`} backLabel="Back to task" />
      <Card><CardBody><TaskNotesForm taskId={task.id} notes={task.notes ?? ""} editable /></CardBody></Card>
    </div>
  );
}
