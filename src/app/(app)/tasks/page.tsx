import Link from "next/link";
import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/session";
import { PermissionDenied } from "@/components/app/permission-denied";
import { TASK_STATUS_LABELS } from "@/lib/labels";
import { listTasks } from "@/server/operations/service";
import { PageHeading } from "@/components/app/page-heading";
import { Badge } from "@/components/ui/badge";
import { buttonClassName } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Select, Label } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const metadata: Metadata = { title: "Turnover tasks" };

const DATE_LABEL = new Intl.DateTimeFormat("en-PH", {
  weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC",
});
const STATUS_TONE: Record<string, "sage" | "clay" | "neutral"> = { open: "clay", ready: "sage" };

export default async function TasksPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const membership = await requirePermission("tasks.view");
  if (!membership) return <PermissionDenied />;
  const params = await searchParams;
  const statusParam = params["status"];
  const statusFilter = statusParam === "open" || statusParam === "ready" ? statusParam : undefined;
  const tasks = await listTasks(membership.organizationId, { status: statusFilter });
  const openCount = tasks.filter((task) => task.status === "open").length;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeading title="Turnover tasks" description="Check and prepare each unit for the next guest. Turnover checklists open automatically at check-out.">
        {tasks.length > 0 ? <p className="rounded-lg bg-sage/40 px-4 py-2 text-sm text-pine">{openCount} to do · {tasks.length - openCount} ready</p> : null}
      </PageHeading>

      <form method="GET" className="flex flex-wrap items-end gap-3 rounded-xl border border-pine/10 bg-sage/25 p-4">
        <div className="min-w-40">
          <Label htmlFor="filter-status">Status</Label>
          <Select id="filter-status" name="status" defaultValue={statusFilter ?? ""}>
            <option value="">All tasks</option>
            <option value="open">Needs cleaning</option>
            <option value="ready">Ready</option>
          </Select>
        </div>
        <button type="submit" className={buttonClassName("outline")}>Filter</button>
        {statusFilter ? <Link href="/tasks" className={buttonClassName("ghost")}>Clear</Link> : null}
      </form>

      <div className="mt-6">
        {tasks.length === 0 ? (
          <EmptyState title={statusFilter ? "No tasks match that filter" : "No turnover tasks yet"} description="Check a guest out from their reservation and the turnover checklist for that unit opens here automatically." />
        ) : (
          <Card>
            <Table aria-label="Turnover tasks">
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Unit</TableHead>
                  <TableHead scope="col">Status</TableHead>
                  <TableHead scope="col">Checklist</TableHead>
                  <TableHead scope="col">Checked out</TableHead>
                  <TableHead scope="col" className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell className="min-w-44">
                      <Link href={`/tasks/${task.id}`} className="font-medium text-pine hover:underline">{task.unitName}</Link>
                      <p className="mt-1 text-xs text-ink/55">{task.propertyName}</p>
                    </TableCell>
                    <TableCell><Badge tone={STATUS_TONE[task.status] ?? "neutral"}>{TASK_STATUS_LABELS[task.status]}</Badge></TableCell>
                    <TableCell className="whitespace-nowrap text-ink/70">{task.doneItems} of {task.totalItems} done</TableCell>
                    <TableCell className="whitespace-nowrap text-ink/60">{DATE_LABEL.format(task.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <Link href={`/tasks/${task.id}`} className={buttonClassName("outline", "sm")} aria-label={`Open turnover for ${task.unitName}`}>Open task</Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </div>
  );
}
