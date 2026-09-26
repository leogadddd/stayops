import Link from "next/link";
import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { PermissionDenied } from "@/components/app/permission-denied";
import { TASK_STATUS_LABELS } from "@/lib/labels";
import { formatPHP } from "@/lib/money";
import { getTaskDetail } from "@/server/operations/service";
import { PageHeading } from "@/components/app/page-heading";
import { Badge } from "@/components/ui/badge";
import { buttonClassName } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checklist } from "./checklist";

export const metadata: Metadata = { title: "Turnover task" };

const DATE_LABEL = new Intl.DateTimeFormat("en-PH", {
  weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC",
});
const TIME_LABEL = new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short" });
const STATUS_TONE: Record<string, "sage" | "clay" | "neutral"> = { open: "clay", ready: "sage" };

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const membership = await requirePermission("tasks.view");
  if (!membership) return <PermissionDenied />;
  const { task, unitName, propertyName, items, openDamage, assessment, nextCheckIn } =
    await getTaskDetail(membership.organizationId, id);
  const open = task.status === "open";
  const canWork = open && can(membership, "tasks.update");
  const canResolveDamage = can(membership, "damage.update");
  const doneCount = items.filter((item) => item.completedAt !== null).length;
  const requiredComplete = items.every((item) => !item.required || item.completedAt !== null);
  const canReviewReady = canWork && requiredComplete && (assessment.canMarkReady || canResolveDamage);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeading title={`Turnover · ${unitName}`} description={`${propertyName} · Check and prepare the unit for the next guest.`} backHref="/tasks" backLabel="All tasks">
        <Badge tone={STATUS_TONE[task.status] ?? "neutral"}>{TASK_STATUS_LABELS[task.status]}</Badge>
      </PageHeading>

      {open && nextCheckIn ? (
        <p className="mb-6 rounded-xl border border-pine/10 bg-sage/40 px-4 py-3 text-sm text-pine" role="status">
          {nextCheckIn.guestName ? `${nextCheckIn.guestName} checks in` : "Next check-in"}{" "}
          {DATE_LABEL.format(new Date(`${nextCheckIn.checkInDate}T00:00:00Z`))} — finish this turnover before then.
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader><h2 className="font-display text-lg text-pine">Turnover checklist</h2></CardHeader>
          <CardBody>
            <Checklist taskId={task.id} editable={canWork} items={items.map((item) => ({
              id: item.id, label: item.label, required: item.required, completed: item.completedAt !== null,
            }))} />
            <div className="mt-4 border-t border-pine/10 pt-4">
              <p className="mb-2 text-sm text-pine">{doneCount} of {items.length} completed</p>
              {items.length > 0 ? <progress aria-label="Turnover progress" value={doneCount} max={items.length} className="h-2 w-full accent-pine" /> : null}
              <p className="mt-2 text-xs text-ink/50">Required items can never be skipped.</p>
            </div>
          </CardBody>
        </Card>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader><h2 className="font-display text-lg text-pine">Ready state</h2></CardHeader>
            <CardBody className="space-y-3">
              {open ? (
                <>
                  <p className="text-sm text-ink/70">{doneCount} of {items.length} items done.</p>
                  {assessment.openDamageCount > 0 ? (
                    <p className="rounded-lg border border-clay/25 bg-clay/10 p-3 text-sm text-clay-deep">
                      {assessment.openDamageCount} open damage {assessment.openDamageCount === 1 ? "report needs" : "reports need"} attention.
                      {canResolveDamage ? " Resolve the damage, or give a reason to mark ready anyway." : " Ask someone who can resolve damage to review it before marking ready."}
                    </p>
                  ) : null}
                  {canReviewReady ? (
                    <Link href={`/tasks/${task.id}/ready`} className={buttonClassName("clay", "md", "w-full")}>
                      {assessment.canMarkReady ? "Mark unit ready" : "Review ready override"}
                    </Link>
                  ) : !requiredComplete ? (
                    <p className="text-sm text-ink/60">Complete every required checklist item before marking the unit ready.</p>
                  ) : null}
                </>
              ) : (
                <>
                  <p className="text-sm text-pine">Marked ready {task.markedReadyAt ? TIME_LABEL.format(task.markedReadyAt) : ""}.</p>
                  {task.readyOverrideReason ? <p className="rounded-lg bg-clay/10 p-3 text-sm text-clay-deep">Marked ready despite open damage: {task.readyOverrideReason}</p> : null}
                  <p className="text-xs text-ink/50">A ready task is final — its checklist can no longer be edited.</p>
                </>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader className="flex items-center justify-between gap-3">
              <h2 className="font-display text-lg text-pine">Notes</h2>
              {canWork ? <Link href={`/tasks/${task.id}/edit`} className="text-sm font-medium text-clay hover:underline">Edit notes</Link> : null}
            </CardHeader>
            <CardBody><p className="whitespace-pre-line text-sm text-ink/70">{task.notes || "No turnover notes yet."}</p></CardBody>
          </Card>

          {task.reservationId ? (
            <Link href={`/reservations/${task.reservationId}`} className="inline-flex text-sm font-medium text-pine underline-offset-4 hover:underline">Open the checked-out reservation →</Link>
          ) : null}
        </div>
      </div>

      <Card className="mt-6">
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg text-pine">Damage reports</h2>
            <p className="mt-1 text-xs text-ink/55">Open reports for this unit.</p>
          </div>
          {open && can(membership, "damage.create") ? <Link href={`/tasks/${task.id}/damage/new`} className={buttonClassName("clay", "sm")}>Report damage</Link> : null}
        </CardHeader>
        {openDamage.length === 0 ? (
          <CardBody><p className="text-sm text-ink/60">No open damage for this unit.</p></CardBody>
        ) : (
          <Table aria-label="Open damage reports">
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Damage</TableHead>
                <TableHead scope="col">Reported</TableHead>
                <TableHead scope="col" className="text-right">Estimated cost</TableHead>
                {canResolveDamage ? <TableHead scope="col" className="text-right">Action</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {openDamage.map((report) => (
                <TableRow key={report.id}>
                  <TableCell className="min-w-56 whitespace-pre-line text-pine">{report.description}</TableCell>
                  <TableCell className="whitespace-nowrap text-ink/60">{TIME_LABEL.format(report.createdAt)}</TableCell>
                  <TableCell className="text-right tabular-nums text-ink/70">{report.estimatedAmountCents !== null ? formatPHP(report.estimatedAmountCents) : "—"}</TableCell>
                  {canResolveDamage ? <TableCell className="text-right"><Link href={`/tasks/${task.id}/damage/${report.id}/resolve`} className={buttonClassName("outline", "sm")}>Resolve</Link></TableCell> : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
