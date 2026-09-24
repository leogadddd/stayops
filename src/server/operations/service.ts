import "server-only";

import { and, asc, count, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  auditEvents,
  damageReports,
  guests,
  properties,
  reservations,
  taskItems,
  tasks,
  units,
} from "@/lib/db/schema";
import { todayInTimeZone } from "@/lib/dates";
import { MoneyParseError, pesosToCentavos } from "@/lib/money";
import {
  assessReady,
  checklistTemplateSchema,
  normalizeChecklistTemplate,
} from "@/lib/turnover";
import {
  insertTransition,
  ReservationError,
} from "@/server/reservations/service";
import { isAllowedTransition } from "@/server/reservations/validation";
import {
  checkInSchema,
  checkOutSchema,
  damageReportSchema,
  markReadySchema,
  OperationsError,
  resolveDamageSchema,
  taskNotesSchema,
} from "./validation";

export { OperationsError } from "./validation";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function recordAudit(
  tx: Tx,
  input: {
    organizationId: string;
    actorUserId: string;
    entity: string;
    entityId: string;
    action: string;
    metadata?: Record<string, unknown>;
  },
) {
  await tx.insert(auditEvents).values({
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    entity: input.entity,
    entityId: input.entityId,
    action: input.action,
    metadata: input.metadata,
  });
}

function parseOptionalAmount(
  value: string | undefined,
  field: string,
): number | null {
  if (!value) return null;
  try {
    return pesosToCentavos(value, { allowZero: false });
  } catch (error) {
    if (error instanceof MoneyParseError) {
      throw new OperationsError(error.message, field);
    }
    throw error;
  }
}

async function getReservationInTx(
  tx: Tx,
  organizationId: string,
  reservationId: string,
) {
  const [reservation] = await tx
    .select()
    .from(reservations)
    .where(
      and(
        eq(reservations.id, reservationId),
        eq(reservations.organizationId, organizationId),
      ),
    )
    .limit(1);
  if (!reservation) {
    throw new ReservationError("Reservation not found.", "reservationId");
  }
  return reservation;
}

// ---------------------------------------------------------------------------
// Stay events (check-in / check-out)
// ---------------------------------------------------------------------------

export async function checkIn(input: {
  organizationId: string;
  actorUserId: string;
  reservationId: string;
  data: unknown;
}) {
  const data = checkInSchema.parse(input.data);
  return db.transaction(async (tx) => {
    const reservation = await getReservationInTx(
      tx,
      input.organizationId,
      input.reservationId,
    );
    if (!isAllowedTransition(reservation.status, "checked_in")) {
      throw new ReservationError(
        `A ${reservation.status} reservation cannot be checked in.`,
      );
    }
    const [updated] = await tx
      .update(reservations)
      .set({ status: "checked_in", updatedAt: new Date() })
      .where(eq(reservations.id, reservation.id))
      .returning();
    if (!updated) {
      throw new ReservationError("Failed to check in the reservation.");
    }
    await insertTransition(tx, {
      organizationId: input.organizationId,
      reservationId: reservation.id,
      fromStatus: reservation.status,
      toStatus: "checked_in",
      note: data.note || "Guest checked in.",
      actorUserId: input.actorUserId,
    });
    await recordAudit(tx, {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      entity: "reservation",
      entityId: reservation.id,
      action: "reservation.checked_in",
      metadata: { unitId: reservation.unitId },
    });
    return updated;
  });
}

export async function checkOut(input: {
  organizationId: string;
  actorUserId: string;
  reservationId: string;
  data: unknown;
}) {
  const data = checkOutSchema.parse(input.data);
  return db.transaction(async (tx) => {
    const reservation = await getReservationInTx(
      tx,
      input.organizationId,
      input.reservationId,
    );
    if (!isAllowedTransition(reservation.status, "checked_out")) {
      throw new ReservationError(
        `A ${reservation.status} reservation cannot be checked out.`,
      );
    }
    const [updated] = await tx
      .update(reservations)
      .set({ status: "checked_out", updatedAt: new Date() })
      .where(eq(reservations.id, reservation.id))
      .returning();
    if (!updated) {
      throw new ReservationError("Failed to check out the reservation.");
    }
    await insertTransition(tx, {
      organizationId: input.organizationId,
      reservationId: reservation.id,
      fromStatus: reservation.status,
      toStatus: "checked_out",
      note: data.note || "Guest checked out.",
      actorUserId: input.actorUserId,
    });

    // Turnover: freeze the unit's current checklist template into a new task
    // so later template edits never rewrite this stay's history.
    const [unit] = await tx
      .select()
      .from(units)
      .where(
        and(
          eq(units.id, reservation.unitId),
          eq(units.organizationId, input.organizationId),
        ),
      )
      .limit(1);
    if (!unit) {
      throw new ReservationError("Unit not found.", "unitId");
    }
    const template = normalizeChecklistTemplate(unit.checklistTemplate);
    const [task] = await tx
      .insert(tasks)
      .values({
        organizationId: input.organizationId,
        unitId: unit.id,
        reservationId: reservation.id,
        status: "open",
        checklistSnapshot: template,
      })
      .returning();
    if (!task) {
      throw new OperationsError("Failed to open the turnover task.");
    }
    if (template.length > 0) {
      await tx.insert(taskItems).values(
        template.map((item, position) => ({
          organizationId: input.organizationId,
          taskId: task.id,
          label: item.label,
          required: item.required,
          position,
        })),
      );
    }

    await recordAudit(tx, {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      entity: "reservation",
      entityId: reservation.id,
      action: "reservation.checked_out",
      metadata: { unitId: reservation.unitId, taskId: task.id },
    });
    await recordAudit(tx, {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      entity: "task",
      entityId: task.id,
      action: "task.created",
      metadata: {
        unitId: unit.id,
        reservationId: reservation.id,
        itemCount: template.length,
      },
    });
    return { reservation: updated, task };
  });
}

// ---------------------------------------------------------------------------
// Turnover tasks
// ---------------------------------------------------------------------------

export async function listTasks(
  organizationId: string,
  filters: { status?: "open" | "ready" } = {},
) {
  const conditions = [eq(tasks.organizationId, organizationId)];
  if (filters.status) {
    conditions.push(eq(tasks.status, filters.status));
  }
  return db
    .select({
      id: tasks.id,
      status: tasks.status,
      unitId: tasks.unitId,
      unitName: units.name,
      propertyName: properties.name,
      reservationId: tasks.reservationId,
      createdAt: tasks.createdAt,
      markedReadyAt: tasks.markedReadyAt,
      totalItems: count(taskItems.id),
      doneItems: sql<number>`count(*) filter (where ${taskItems.completedAt} is not null)`.mapWith(
        Number,
      ),
    })
    .from(tasks)
    .innerJoin(
      units,
      and(eq(tasks.unitId, units.id), eq(tasks.organizationId, units.organizationId)),
    )
    .innerJoin(properties, eq(units.propertyId, properties.id))
    .leftJoin(
      taskItems,
      and(eq(taskItems.taskId, tasks.id), eq(taskItems.organizationId, organizationId)),
    )
    .where(and(...conditions))
    .groupBy(tasks.id, units.id, properties.id)
    .orderBy(asc(tasks.status), desc(tasks.createdAt));
}

export async function getTaskForReservation(
  organizationId: string,
  reservationId: string,
) {
  const rows = await db
    .select({
      id: tasks.id,
      status: tasks.status,
      createdAt: tasks.createdAt,
      markedReadyAt: tasks.markedReadyAt,
      totalItems: count(taskItems.id),
      doneItems: sql<number>`count(*) filter (where ${taskItems.completedAt} is not null)`.mapWith(
        Number,
      ),
    })
    .from(tasks)
    .leftJoin(
      taskItems,
      and(eq(taskItems.taskId, tasks.id), eq(taskItems.organizationId, organizationId)),
    )
    .where(
      and(eq(tasks.reservationId, reservationId), eq(tasks.organizationId, organizationId)),
    )
    .groupBy(tasks.id)
    .orderBy(desc(tasks.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function getTaskDetail(organizationId: string, taskId: string) {
  const [row] = await db
    .select({
      task: tasks,
      unitName: units.name,
      propertyName: properties.name,
      propertyTimeZone: properties.timezone,
      reservationId: reservations.id,
      guestName: guests.name,
    })
    .from(tasks)
    .innerJoin(
      units,
      and(eq(tasks.unitId, units.id), eq(tasks.organizationId, units.organizationId)),
    )
    .innerJoin(properties, eq(units.propertyId, properties.id))
    .leftJoin(
      reservations,
      and(
        eq(tasks.reservationId, reservations.id),
        eq(tasks.organizationId, reservations.organizationId),
      ),
    )
    .leftJoin(
      guests,
      and(
        eq(reservations.guestId, guests.id),
        eq(reservations.organizationId, guests.organizationId),
      ),
    )
    .where(and(eq(tasks.id, taskId), eq(tasks.organizationId, organizationId)))
    .limit(1);
  if (!row) {
    throw new OperationsError("Task not found.", "taskId");
  }

  const [items, openDamage] = await Promise.all([
    db
      .select()
      .from(taskItems)
      .where(
        and(eq(taskItems.taskId, taskId), eq(taskItems.organizationId, organizationId)),
      )
      .orderBy(asc(taskItems.position), asc(taskItems.createdAt)),
    db
      .select()
      .from(damageReports)
      .where(
        and(
          eq(damageReports.unitId, row.task.unitId),
          eq(damageReports.organizationId, organizationId),
          eq(damageReports.status, "open"),
        ),
      )
      .orderBy(desc(damageReports.createdAt)),
  ]);

  const assessment = assessReady(
    items.map((item) => ({
      label: item.label,
      required: item.required,
      completed: item.completedAt !== null,
    })),
    openDamage.length,
  );

  let nextCheckIn: {
    reservationId: string;
    checkInDate: string;
    guestName: string | null;
  } | null = null;
  if (row.task.status === "open") {
    const [next] = await db
      .select({
        reservationId: reservations.id,
        checkInDate: reservations.checkInDate,
        guestName: guests.name,
      })
      .from(reservations)
      .leftJoin(
        guests,
        and(
          eq(reservations.guestId, guests.id),
          eq(reservations.organizationId, guests.organizationId),
        ),
      )
      .where(
        and(
          eq(reservations.organizationId, organizationId),
          eq(reservations.unitId, row.task.unitId),
          eq(reservations.status, "confirmed"),
          gte(
            reservations.checkInDate,
            todayInTimeZone(row.propertyTimeZone ?? "Asia/Manila"),
          ),
        ),
      )
      .orderBy(asc(reservations.checkInDate))
      .limit(1);
    nextCheckIn = next ?? null;
  }

  return {
    ...row,
    items,
    openDamage,
    assessment,
    nextCheckIn,
  };
}

export async function setTaskItemCompleted(input: {
  organizationId: string;
  actorUserId: string;
  taskId: string;
  itemId: string;
  completed: boolean;
}) {
  return db.transaction(async (tx) => {
    const [task] = await tx
      .select({ id: tasks.id, status: tasks.status, unitId: tasks.unitId })
      .from(tasks)
      .where(
        and(eq(tasks.id, input.taskId), eq(tasks.organizationId, input.organizationId)),
      )
      .limit(1);
    if (!task) {
      throw new OperationsError("Task not found.", "taskId");
    }
    if (task.status !== "open") {
      throw new OperationsError(
        "This task is already marked ready and can no longer be edited.",
      );
    }
    const [item] = await tx
      .select()
      .from(taskItems)
      .where(
        and(
          eq(taskItems.id, input.itemId),
          eq(taskItems.taskId, task.id),
          eq(taskItems.organizationId, input.organizationId),
        ),
      )
      .limit(1);
    if (!item) {
      throw new OperationsError("Checklist item not found.", "itemId");
    }
    await tx
      .update(taskItems)
      .set({
        completedAt: input.completed ? new Date() : null,
        completedBy: input.completed ? input.actorUserId : null,
      })
      .where(eq(taskItems.id, item.id));
    await recordAudit(tx, {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      entity: "task",
      entityId: task.id,
      action: input.completed ? "task.item_completed" : "task.item_reopened",
      metadata: { itemId: item.id, label: item.label },
    });
  });
}

export async function updateTaskNotes(input: {
  organizationId: string;
  actorUserId: string;
  taskId: string;
  data: unknown;
}) {
  const data = taskNotesSchema.parse(input.data);
  await db.transaction(async (tx) => {
    const [task] = await tx
      .select({ id: tasks.id, unitId: tasks.unitId })
      .from(tasks)
      .where(
        and(eq(tasks.id, input.taskId), eq(tasks.organizationId, input.organizationId)),
      )
      .limit(1);
    if (!task) {
      throw new OperationsError("Task not found.", "taskId");
    }
    const notes = data.notes || null;
    await tx
      .update(tasks)
      .set({ notes, updatedAt: new Date() })
      .where(eq(tasks.id, task.id));
    await recordAudit(tx, {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      entity: "task",
      entityId: task.id,
      action: "task.notes_updated",
      metadata: {
        unitId: task.unitId,
        hasNotes: notes !== null,
        characterCount: notes?.length ?? 0,
      },
    });
  });
}

export async function markTaskReady(input: {
  organizationId: string;
  actorUserId: string;
  actorRole: "owner" | "staff";
  taskId: string;
  data: unknown;
}) {
  const data = markReadySchema.parse(input.data);
  return db.transaction(async (tx) => {
    const [task] = await tx
      .select()
      .from(tasks)
      .where(
        and(eq(tasks.id, input.taskId), eq(tasks.organizationId, input.organizationId)),
      )
      .limit(1);
    if (!task) {
      throw new OperationsError("Task not found.", "taskId");
    }
    if (task.status !== "open") {
      throw new OperationsError("This task is already marked ready.");
    }
    const items = await tx
      .select()
      .from(taskItems)
      .where(
        and(eq(taskItems.taskId, task.id), eq(taskItems.organizationId, input.organizationId)),
      );
    const openDamage = await tx
      .select({ id: damageReports.id })
      .from(damageReports)
      .where(
        and(
          eq(damageReports.unitId, task.unitId),
          eq(damageReports.organizationId, input.organizationId),
          eq(damageReports.status, "open"),
        ),
      );
    const assessment = assessReady(
      items.map((item) => ({
        label: item.label,
        required: item.required,
        completed: item.completedAt !== null,
      })),
      openDamage.length,
    );

    let overrideReason: string | null = null;
    if (!assessment.canMarkReady) {
      if (assessment.missingRequired.length > 0) {
        const shown = assessment.missingRequired.slice(0, 3).join(", ");
        throw new OperationsError(
          `Complete every required item first. Still open: ${shown}${
            assessment.missingRequired.length > 3 ? "…" : ""
          }`,
        );
      }
      // Open damage: owner may override with an audited reason; staff may not.
      if (!data.overrideReason) {
        throw new OperationsError(
          "Damage needs attention. Resolve the reports below, or as the owner give a reason to mark ready anyway.",
          "overrideReason",
        );
      }
      if (input.actorRole !== "owner") {
        throw new OperationsError(
          "Only the owner can mark a unit ready while damage is open.",
          "overrideReason",
        );
      }
      overrideReason = data.overrideReason;
    }

    const [updated] = await tx
      .update(tasks)
      .set({
        status: "ready",
        markedReadyAt: new Date(),
        markedReadyBy: input.actorUserId,
        readyOverrideReason: overrideReason,
        updatedAt: new Date(),
      })
      .where(and(eq(tasks.id, task.id), eq(tasks.status, "open")))
      .returning();
    if (!updated) {
      throw new OperationsError("This task was just updated by someone else.");
    }
    await recordAudit(tx, {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      entity: "task",
      entityId: task.id,
      action: "task.marked_ready",
      metadata: {
        unitId: task.unitId,
        reservationId: task.reservationId,
        override: overrideReason !== null,
        openDamageCount: openDamage.length,
      },
    });
    return updated;
  });
}

// ---------------------------------------------------------------------------
// Checklist template (per unit)
// ---------------------------------------------------------------------------

/**
 * Updates the unit's template for FUTURE turnovers. Open tasks keep their
 * frozen snapshot, so this never rewrites work already in progress.
 */
export async function updateChecklistTemplate(input: {
  organizationId: string;
  actorUserId: string;
  unitId: string;
  data: unknown;
}) {
  const template = checklistTemplateSchema.parse(input.data);
  return db.transaction(async (tx) => {
    const [unit] = await tx
      .select({ id: units.id, name: units.name })
      .from(units)
      .where(
        and(eq(units.id, input.unitId), eq(units.organizationId, input.organizationId)),
      )
      .limit(1);
    if (!unit) {
      throw new OperationsError("Unit not found.", "unitId");
    }
    const [updated] = await tx
      .update(units)
      .set({ checklistTemplate: template })
      .where(eq(units.id, unit.id))
      .returning();
    if (!updated) {
      throw new OperationsError("Failed to update the checklist template.");
    }
    await recordAudit(tx, {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      entity: "unit",
      entityId: unit.id,
      action: "unit.checklist_updated",
      metadata: { itemCount: template.length },
    });
    return updated;
  });
}

// ---------------------------------------------------------------------------
// Damage reports
// ---------------------------------------------------------------------------

export async function createDamageReport(input: {
  organizationId: string;
  actorUserId: string;
  unitId: string;
  reservationId?: string;
  data: unknown;
}) {
  const raw =
    typeof input.data === "object" && input.data !== null ? input.data : {};
  const data = damageReportSchema.parse({
    ...raw,
    unitId: input.unitId,
    ...(input.reservationId ? { reservationId: input.reservationId } : {}),
  });
  const estimatedAmountCents = parseOptionalAmount(
    data.estimatedAmountPesos,
    "estimatedAmountPesos",
  );
  const actualAmountCents = parseOptionalAmount(
    data.actualAmountPesos,
    "actualAmountPesos",
  );

  return db.transaction(async (tx) => {
    const [unit] = await tx
      .select({ id: units.id })
      .from(units)
      .where(
        and(eq(units.id, data.unitId), eq(units.organizationId, input.organizationId)),
      )
      .limit(1);
    if (!unit) {
      throw new OperationsError("Unit not found.", "unitId");
    }
    if (data.reservationId) {
      const reservation = await getReservationInTx(
        tx,
        input.organizationId,
        data.reservationId,
      );
      if (reservation.unitId !== unit.id) {
        throw new OperationsError(
          "That reservation belongs to a different unit.",
          "reservationId",
        );
      }
    }
    const [report] = await tx
      .insert(damageReports)
      .values({
        organizationId: input.organizationId,
        unitId: unit.id,
        reservationId: data.reservationId ?? null,
        description: data.description,
        estimatedAmountCents,
        actualAmountCents,
      })
      .returning();
    if (!report) {
      throw new OperationsError("Failed to record the damage report.");
    }
    await recordAudit(tx, {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      entity: "damage_report",
      entityId: report.id,
      action: "damage.reported",
      metadata: {
        unitId: unit.id,
        reservationId: data.reservationId ?? null,
        description: report.description,
        estimatedAmountCents,
        actualAmountCents,
      },
    });
    return report;
  });
}

export async function resolveDamageReport(input: {
  organizationId: string;
  actorUserId: string;
  damageReportId: string;
  data: unknown;
}) {
  const data = resolveDamageSchema.parse(input.data);
  const actualAmountCents = parseOptionalAmount(
    data.actualAmountPesos,
    "actualAmountPesos",
  );
  return db.transaction(async (tx) => {
    const [report] = await tx
      .select()
      .from(damageReports)
      .where(
        and(
          eq(damageReports.id, input.damageReportId),
          eq(damageReports.organizationId, input.organizationId),
        ),
      )
      .limit(1);
    if (!report) {
      throw new OperationsError("Damage report not found.", "damageReportId");
    }
    if (report.status !== "open") {
      throw new OperationsError("This damage report is already resolved.");
    }
    const [updated] = await tx
      .update(damageReports)
      .set({
        status: "resolved",
        resolvedAt: new Date(),
        resolvedBy: input.actorUserId,
        resolutionNote: data.resolutionNote,
        actualAmountCents,
      })
      .where(
        and(
          eq(damageReports.id, report.id),
          eq(damageReports.status, "open"),
        ),
      )
      .returning();
    if (!updated) {
      throw new OperationsError("This damage report was just updated.");
    }
    await recordAudit(tx, {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      entity: "damage_report",
      entityId: report.id,
      action: "damage.resolved",
      metadata: {
        unitId: report.unitId,
        reservationId: report.reservationId,
        resolutionNote: data.resolutionNote,
        actualAmountCents,
      },
    });
    return updated;
  });
}

export async function listDamageReports(organizationId: string, unitId: string) {
  return db
    .select()
    .from(damageReports)
    .where(
      and(
        eq(damageReports.unitId, unitId),
        eq(damageReports.organizationId, organizationId),
      ),
    )
    .orderBy(desc(damageReports.createdAt));
}

export async function listOpenDamageReports(organizationId: string, unitId: string) {
  return db
    .select()
    .from(damageReports)
    .where(
      and(
        eq(damageReports.unitId, unitId),
        eq(damageReports.organizationId, organizationId),
        eq(damageReports.status, "open"),
      ),
    )
    .orderBy(desc(damageReports.createdAt));
}
