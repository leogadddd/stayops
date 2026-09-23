import Link from "next/link";
import type { Metadata } from "next";
import { requireMembership } from "@/lib/auth/session";
import { TASK_STATUS_LABELS } from "@/lib/labels";
import { listTasks } from "@/server/operations/service";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Select, Label } from "@/components/ui/input";

export const metadata: Metadata = { title: "Tasks" };

const DATE_LABEL = new Intl.DateTimeFormat("en-PH", {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

const STATUS_TONE: Record<string, "sage" | "clay" | "neutral"> = {
  open: "clay",
  ready: "sage",
};

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const membership = await requireMembership();
  const params = await searchParams;
  const statusParam = params["status"];
  const statusFilter =
    statusParam === "open" || statusParam === "ready" ? statusParam : undefined;

  const tasks = await listTasks(membership.organizationId, {
    status: statusFilter,
  });
  const openCount = tasks.filter((task) => task.status === "open").length;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-pine">Tasks</h1>
          <p className="mt-1 text-sm text-ink/60">
            Turnover checklists created at check-out. A unit is ready for the
            next guest when its task is marked ready.
          </p>
        </div>
        {tasks.length > 0 ? (
          <p className="text-sm text-ink/60">
            {openCount} to do · {tasks.length - openCount} ready
          </p>
        ) : null}
      </div>

      <form method="GET" className="mt-5 flex flex-wrap items-end gap-3">
        <div className="min-w-40">
          <Label htmlFor="filter-status">Status</Label>
          <Select id="filter-status" name="status" defaultValue={statusFilter ?? ""}>
            <option value="">All tasks</option>
            <option value="open">Needs cleaning</option>
            <option value="ready">Ready</option>
          </Select>
        </div>
        <button
          type="submit"
          className="h-10 rounded-lg bg-pine px-4 text-sm font-medium text-white hover:bg-pine-soft"
        >
          Filter
        </button>
        {statusFilter ? (
          <Link
            href="/tasks"
            className="h-10 inline-flex items-center rounded-lg px-3 text-sm text-pine hover:bg-pine-mist/70"
          >
            Clear
          </Link>
        ) : null}
      </form>

      {tasks.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title={statusFilter ? "No tasks match that filter" : "No turnover tasks yet"}
            description="Check a guest out from their reservation and the turnover checklist for that unit opens here automatically."
          />
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {tasks.map((task) => (
            <Link key={task.id} href={`/tasks/${task.id}`} className="block">
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardBody>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-display text-lg text-pine">
                        {task.unitName}
                      </p>
                      <p className="text-xs text-ink/50">{task.propertyName}</p>
                    </div>
                    <Badge tone={STATUS_TONE[task.status] ?? "neutral"}>
                      {TASK_STATUS_LABELS[task.status]}
                    </Badge>
                  </div>
                  <p className="mt-3 text-sm text-ink/70">
                    {task.doneItems} of {task.totalItems} items done
                  </p>
                  <p className="mt-1 text-xs text-ink/45">
                    Checked out {DATE_LABEL.format(task.createdAt)}
                  </p>
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
