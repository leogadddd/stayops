import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { organizations } from "./orgs";
import { units } from "./inventory";
import { reservations } from "./reservations";
import type { ChecklistTemplateItem } from "@/lib/turnover";

export const TASK_STATUSES = ["open", "ready"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
export const taskStatus = pgEnum("task_status", TASK_STATUSES);

export const DAMAGE_STATUSES = ["open", "resolved"] as const;
export type DamageStatus = (typeof DAMAGE_STATUSES)[number];
export const damageStatus = pgEnum("damage_status", DAMAGE_STATUSES);

/**
 * Turnover work opened by checkout (PRD §3.5). `checklistSnapshot` freezes the
 * unit template at creation so later template edits never rewrite history.
 * `ready` requires every required item completed plus an explicit mark-ready
 * action; `readyOverrideReason` records the audited owner override used to
 * bypass open damage reports only.
 */
export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    unitId: uuid("unit_id").notNull(),
    reservationId: uuid("reservation_id"),
    status: taskStatus("status").notNull().default("open"),
    checklistSnapshot: jsonb("checklist_snapshot")
      .$type<ChecklistTemplateItem[]>()
      .notNull(),
    notes: text("notes"),
    markedReadyAt: timestamp("marked_ready_at", { withTimezone: true }),
    markedReadyBy: text("marked_ready_by").references(() => user.id, {
      onDelete: "set null",
    }),
    readyOverrideReason: text("ready_override_reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Unique constraint (not just an index) so sibling tables in the same
    // migration can reference (organization_id, id) in composite foreign keys.
    unique("tasks_organization_id_unique").on(table.organizationId, table.id),
    foreignKey({
      columns: [table.organizationId, table.unitId],
      foreignColumns: [units.organizationId, units.id],
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.organizationId, table.reservationId],
      foreignColumns: [reservations.organizationId, reservations.id],
    }).onDelete("cascade"),
  ],
);

/** A timestamped automatic cleaning window, distinct from manual unit blocks. */
export const turnoverBlocks = pgTable(
  "turnover_blocks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    unitId: uuid("unit_id").notNull(),
    reservationId: uuid("reservation_id").notNull(),
    taskId: uuid("task_id").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("turnover_blocks_reservation_unique").on(table.reservationId),
    index("turnover_blocks_unit_time_idx").on(table.unitId, table.startsAt, table.endsAt),
    foreignKey({ columns: [table.organizationId, table.unitId], foreignColumns: [units.organizationId, units.id] }).onDelete("cascade"),
    foreignKey({ columns: [table.organizationId, table.reservationId], foreignColumns: [reservations.organizationId, reservations.id] }).onDelete("cascade"),
    foreignKey({ columns: [table.organizationId, table.taskId], foreignColumns: [tasks.organizationId, tasks.id] }).onDelete("cascade"),
    check("turnover_blocks_range_check", sql`${table.endsAt} > ${table.startsAt}`),
    check("turnover_blocks_duration_check", sql`${table.durationMinutes} >= 1 AND ${table.durationMinutes} <= 1440`),
  ],
);

export const taskItems = pgTable(
  "task_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    taskId: uuid("task_id").notNull(),
    label: text("label").notNull(),
    required: boolean("required").notNull().default(true),
    position: integer("position").notNull().default(0),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    completedBy: text("completed_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("task_items_organization_id_unique").on(table.organizationId, table.id),
    foreignKey({
      columns: [table.organizationId, table.taskId],
      foreignColumns: [tasks.organizationId, tasks.id],
    }).onDelete("cascade"),
    check("task_items_label_check", sql`char_length(trim(${table.label})) > 0`),
    check("task_items_position_check", sql`${table.position} >= 0`),
  ],
);

/**
 * Damage or incident record. An open report keeps the unit from being marked
 * ready until the owner resolves it or overrides with an audited reason.
 * Amounts are estimated/actual repair costs in centavos, not collected money.
 */
export const damageReports = pgTable(
  "damage_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    unitId: uuid("unit_id").notNull(),
    reservationId: uuid("reservation_id"),
    description: text("description").notNull(),
    estimatedAmountCents: integer("estimated_amount_cents"),
    actualAmountCents: integer("actual_amount_cents"),
    status: damageStatus("status").notNull().default("open"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolvedBy: text("resolved_by").references(() => user.id, {
      onDelete: "set null",
    }),
    resolutionNote: text("resolution_note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("damage_reports_organization_id_unique").on(table.organizationId, table.id),
    foreignKey({
      columns: [table.organizationId, table.unitId],
      foreignColumns: [units.organizationId, units.id],
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.organizationId, table.reservationId],
      foreignColumns: [reservations.organizationId, reservations.id],
    }).onDelete("cascade"),
    check(
      "damage_reports_description_check",
      sql`char_length(trim(${table.description})) > 0`,
    ),
    check(
      "damage_reports_estimated_check",
      sql`${table.estimatedAmountCents} IS NULL OR ${table.estimatedAmountCents} > 0`,
    ),
    check(
      "damage_reports_actual_check",
      sql`${table.actualAmountCents} IS NULL OR ${table.actualAmountCents} > 0`,
    ),
  ],
);
