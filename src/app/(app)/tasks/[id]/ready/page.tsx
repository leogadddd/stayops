import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireMembership } from "@/lib/auth/session";
import { getTaskDetail } from "@/server/operations/service";
import { PageHeading } from "@/components/app/page-heading";
import { Card, CardBody } from "@/components/ui/card";
import { MarkReadyForm } from "../mark-ready-form";

export const metadata: Metadata = { title: "Mark unit ready" };

export default async function TaskReadyPage({ params }: { params: Promise<{ id: string }> }) {
  const membership = await requireMembership();
  const { id } = await params;
  const { task, unitName, propertyName, items, assessment } = await getTaskDetail(membership.organizationId, id);
  if (task.status !== "open") redirect(`/tasks/${task.id}`);
  const requiredComplete = items.every((item) => !item.required || item.completedAt !== null);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeading title="Mark unit ready" description={`${propertyName} · ${unitName}`} backHref={`/tasks/${task.id}`} backLabel="Back to task" />
      <Card><CardBody className="space-y-4">
        <p className="rounded-lg bg-sage/35 p-4 text-sm text-pine">Marking ready is final. The turnover checklist will become read-only.</p>
        {!requiredComplete ? (
          <p className="text-sm text-ink/70">Complete every required checklist item before marking the unit ready. Damage overrides never skip required items.</p>
        ) : assessment.openDamageCount > 0 && membership.role !== "owner" ? (
          <p className="text-sm text-ink/70">Only the owner can mark a unit ready while damage is open. Ask the owner to resolve the damage or review an override.</p>
        ) : (
          <MarkReadyForm taskId={task.id} canMarkReady={assessment.canMarkReady} openDamageCount={assessment.openDamageCount} actorRole={membership.role} />
        )}
      </CardBody></Card>
    </div>
  );
}
