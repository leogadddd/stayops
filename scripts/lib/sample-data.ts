import { inArray, and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditEvents, paymentEntries, reservations, taskItems, tasks } from "@/lib/db/schema";
import { markTaskReady, setTaskItemCompleted } from "@/server/operations/service";

/** Shared by the demo and sample-data scripts. */

export function assertSafeDatabase() {
  const url = new URL(process.env.DATABASE_URL ?? "");
  const local = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  console.log(`Database: ${url.hostname}:${url.port || 5432}${url.pathname}`);
  if (!local && !process.argv.includes("--allow-remote")) {
    throw new Error("Refusing to write to a non-local database. Pass --allow-remote if you really mean it.");
  }
}

/** Ticks every checklist item and marks the turnover ready, like a finished cleaning. */
export async function finishTurnover(ctx: { organizationId: string; actorUserId: string }, reservationId: string) {
  const openTasks = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(eq(tasks.organizationId, ctx.organizationId), eq(tasks.reservationId, reservationId), eq(tasks.status, "open")));
  for (const task of openTasks) {
    const items = await db
      .select({ id: taskItems.id })
      .from(taskItems)
      .where(and(eq(taskItems.taskId, task.id), isNull(taskItems.completedAt)));
    for (const item of items) {
      await setTaskItemCompleted({ ...ctx, taskId: task.id, itemId: item.id, completed: true });
    }
    await markTaskReady({ ...ctx, canOverrideDamage: true, taskId: task.id, data: {} });
  }
}

/** Hard-deletes reservations and their audit trail; payments, tasks and turnover blocks cascade. */
export async function removeReservations(reservationIds: string[]) {
  if (!reservationIds.length) return;
  const related = await db
    .select({ paymentId: paymentEntries.id })
    .from(paymentEntries)
    .where(inArray(paymentEntries.reservationId, reservationIds));
  const taskIds = (await db.select({ id: tasks.id }).from(tasks).where(inArray(tasks.reservationId, reservationIds))).map((row) => row.id);
  const ids = [...reservationIds, ...related.map((row) => row.paymentId), ...taskIds];
  await db.transaction(async (tx) => {
    await tx.delete(auditEvents).where(inArray(auditEvents.entityId, ids));
    await tx.delete(reservations).where(inArray(reservations.id, reservationIds));
  });
}
