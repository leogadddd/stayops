import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { requireMembership } from "@/lib/auth/session";
import { TASK_STATUS_LABELS } from "@/lib/labels";
import { formatPHP } from "@/lib/money";
import { getTaskDetail } from "@/server/operations/service";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Checklist } from "./checklist";
import { MarkReadyForm } from "./mark-ready-form";
import { TaskNotesForm } from "./task-notes-form";
import { ResolveDamageForm } from "./resolve-damage-form";
import { DamageReportForm } from "../damage-report-form";

export const metadata: Metadata = { title: "Turnover task" };

const DATE_LABEL = new Intl.DateTimeFormat("en-PH", {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});
const TIME_LABEL = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
  timeStyle: "short",
});

const STATUS_TONE: Record<string, "sage" | "clay" | "neutral"> = {
  open: "clay",
  ready: "sage",
};

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const membership = await requireMembership();
  const detail = await getTaskDetail(membership.organizationId, id);
  const { task, unitName, propertyName, items, openDamage, assessment, nextCheckIn } =
    detail;
  const open = task.status === "open";
  const doneCount = items.filter((item) => item.completedAt !== null).length;

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/tasks"
        className="inline-flex items-center gap-1.5 text-sm text-pine/70 underline-offset-4 hover:text-pine hover:underline"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        All tasks
      </Link>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-pine">{unitName}</h1>
          <p className="mt-1 text-sm text-ink/60">{propertyName} · Turnover</p>
        </div>
        <Badge tone={STATUS_TONE[task.status] ?? "neutral"}>
          {TASK_STATUS_LABELS[task.status]}
        </Badge>
      </div>

      {open && nextCheckIn ? (
        <p
          className="mt-3 rounded-xl border border-clay/40 bg-clay-mist/60 px-4 py-3 text-sm text-clay-deep"
          role="status"
        >
          {nextCheckIn.guestName ? `${nextCheckIn.guestName} checks in` : "Next check-in"}{" "}
          {DATE_LABEL.format(new Date(`${nextCheckIn.checkInDate}T00:00:00Z`))} — finish
          this turnover before then.
        </p>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <Card>
            <CardHeader>
              <h2 className="font-display text-lg text-pine">Checklist</h2>
            </CardHeader>
            <CardBody>
              <Checklist
                taskId={task.id}
                editable={open}
                items={items.map((item) => ({
                  id: item.id,
                  label: item.label,
                  required: item.required,
                  completed: item.completedAt !== null,
                }))}
              />
              <p className="mt-3 border-t border-pine/10 pt-3 text-xs text-ink/45">
                {doneCount} of {items.length} done. Required items can never be
                skipped.
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="font-display text-lg text-pine">Damage</h2>
            </CardHeader>
            <CardBody className="space-y-4">
              {openDamage.length === 0 ? (
                <p className="text-sm text-ink/60">No open damage for this unit.</p>
              ) : (
                openDamage.map((report) => (
                  <div
                    key={report.id}
                    className="rounded-xl border border-clay/30 bg-cream p-4"
                  >
                    <p className="text-sm text-pine">{report.description}</p>
                    <p className="mt-1 text-xs text-ink/50">
                      Reported {TIME_LABEL.format(report.createdAt)}
                      {report.estimatedAmountCents !== null
                        ? ` · est. ${formatPHP(report.estimatedAmountCents)}`
                        : ""}
                    </p>
                    <div className="mt-3 border-t border-clay/20 pt-3">
                      <ResolveDamageForm damageReportId={report.id} />
                    </div>
                  </div>
                ))
              )}
              {open ? (
                <div className="border-t border-pine/10 pt-4">
                  <h3 className="text-sm font-medium text-pine">Report new damage</h3>
                  <div className="mt-2">
                    <DamageReportForm unitId={task.unitId} />
                  </div>
                </div>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="font-display text-lg text-pine">Notes</h2>
            </CardHeader>
            <CardBody>
              <TaskNotesForm
                taskId={task.id}
                notes={task.notes ?? ""}
                editable={open}
              />
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <h2 className="font-display text-lg text-pine">Ready state</h2>
            </CardHeader>
            <CardBody className="space-y-3">
              {open ? (
                <>
                  <p className="text-sm text-ink/70">
                    {doneCount} of {items.length} items done.
                    {assessment.openDamageCount > 0
                      ? ` ${assessment.openDamageCount} open damage report${
                          assessment.openDamageCount === 1 ? "" : "s"
                        }.`
                      : ""}
                  </p>
                  <MarkReadyForm
                    taskId={task.id}
                    canMarkReady={assessment.canMarkReady}
                    openDamageCount={assessment.openDamageCount}
                    actorRole={membership.role}
                  />
                </>
              ) : (
                <>
                  <p className="text-sm text-pine">
                    Marked ready {task.markedReadyAt ? TIME_LABEL.format(task.markedReadyAt) : ""}.
                  </p>
                  {task.readyOverrideReason ? (
                    <p className="rounded-xl border border-clay/40 bg-clay-mist/60 px-3 py-2 text-sm text-clay-deep">
                      Marked ready despite open damage: {task.readyOverrideReason}
                    </p>
                  ) : null}
                  <p className="text-xs text-ink/45">
                    A ready task is final — its checklist can no longer be edited.
                  </p>
                </>
              )}
            </CardBody>
          </Card>

          {task.reservationId ? (
            <Card>
              <CardHeader>
                <h2 className="font-display text-lg text-pine">Stay</h2>
              </CardHeader>
              <CardBody>
                <Link
                  href={`/reservations/${task.reservationId}`}
                  className="text-sm font-medium text-pine underline-offset-4 hover:underline"
                >
                  Open the checked-out reservation →
                </Link>
              </CardBody>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
