import { sql } from "drizzle-orm";
import {
  check,
  date,
  foreignKey,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { organizations } from "./orgs";
import { properties, units } from "./inventory";
import { reservations } from "./reservations";

export const PAYMENT_ALLOCATIONS = ["booking", "security_deposit"] as const;
export type PaymentAllocation = (typeof PAYMENT_ALLOCATIONS)[number];
export const paymentAllocation = pgEnum(
  "payment_allocation",
  PAYMENT_ALLOCATIONS,
);

export const PAYMENT_METHODS = [
  "gcash",
  "maya",
  "bank_transfer",
  "cash",
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const paymentMethod = pgEnum("payment_method", PAYMENT_METHODS);

/**
 * Immutable money ledger. Adjustments are new entries (refunds, deductions,
 * reversals) — original rows are never edited. `reversalOfId` marks a
 * correcting entry that supersedes a mistaken one; the original stays.
 */
export const paymentEntries = pgTable(
  "payment_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    reservationId: uuid("reservation_id").notNull(),
    allocation: paymentAllocation("allocation").notNull(),
    amountCents: integer("amount_cents").notNull(),
    method: paymentMethod("method").notNull(),
    reference: text("reference"),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
    recordedBy: text("recorded_by").references(() => user.id, {
      onDelete: "set null",
    }),
    reversalOfId: uuid("reversal_of_id"),
    // Client-generated key: retried submissions with the same key return the
    // existing entry instead of inserting a duplicate.
    idempotencyKey: text("idempotency_key"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("payment_entries_organization_id_unique").on(
      table.organizationId,
      table.id,
    ),
    uniqueIndex("payment_entries_idempotency_unique").on(
      table.organizationId,
      table.idempotencyKey,
    ),
    foreignKey({
      columns: [table.organizationId, table.reservationId],
      foreignColumns: [reservations.organizationId, reservations.id],
    }).onDelete("cascade"),
  ],
);

export const refundEntries = pgTable(
  "refund_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    reservationId: uuid("reservation_id").notNull(),
    allocation: paymentAllocation("allocation").notNull(),
    amountCents: integer("amount_cents").notNull(),
    method: paymentMethod("method").notNull(),
    reason: text("reason").notNull(),
    refundedAt: timestamp("refunded_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    recordedBy: text("recorded_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("refund_entries_organization_id_unique").on(
      table.organizationId,
      table.id,
    ),
    check("refund_entries_amount_positive", sql`${table.amountCents} > 0`),
    foreignKey({
      columns: [table.organizationId, table.reservationId],
      foreignColumns: [reservations.organizationId, reservations.id],
    }).onDelete("cascade"),
  ],
);

/**
 * Itemized retention out of a collected security deposit. Always tied to a
 * written reason; `damageReportId` links to a damage record when slice 4
 * lands (plain nullable uuid until then).
 */
export const depositDeductions = pgTable(
  "deposit_deductions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    reservationId: uuid("reservation_id").notNull(),
    amountCents: integer("amount_cents").notNull(),
    reason: text("reason").notNull(),
    damageReportId: uuid("damage_report_id"),
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("deposit_deductions_organization_id_unique").on(
      table.organizationId,
      table.id,
    ),
    check("deposit_deductions_amount_positive", sql`${table.amountCents} > 0`),
    foreignKey({
      columns: [table.organizationId, table.reservationId],
      foreignColumns: [reservations.organizationId, reservations.id],
    }).onDelete("cascade"),
  ],
);

export const PROOF_STATUSES = ["unverified", "recorded", "dismissed"] as const;
export type ProofStatus = (typeof PROOF_STATUSES)[number];
export const proofStatus = pgEnum("proof_status", PROOF_STATUSES);

/**
 * Guest-submitted payment references from the private booking-status page.
 * Unverified evidence only: an owner must verify and record the payment
 * before it affects any balance.
 */
export const paymentProofs = pgTable(
  "payment_proofs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    reservationId: uuid("reservation_id").notNull(),
    reference: text("reference").notNull(),
    note: text("note"),
    status: proofStatus("status").notNull().default("unverified"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("payment_proofs_organization_id_unique").on(
      table.organizationId,
      table.id,
    ),
    foreignKey({
      columns: [table.organizationId, table.reservationId],
      foreignColumns: [reservations.organizationId, reservations.id],
    }).onDelete("cascade"),
  ],
);

export const EXPENSE_CLASSIFICATIONS = ["operating", "capital"] as const;
export type ExpenseClassification = (typeof EXPENSE_CLASSIFICATIONS)[number];
export const expenseClassification = pgEnum(
  "expense_classification",
  EXPENSE_CLASSIFICATIONS,
);

export const EXPENSE_CATEGORIES = [
  "cleaning",
  "utilities",
  "supplies",
  "maintenance",
  "internet",
  "platform_fees",
  "renovation",
  "other",
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const expenses = pgTable(
  "expenses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    propertyId: uuid("property_id").notNull(),
    unitId: uuid("unit_id"),
    amountCents: integer("amount_cents").notNull(),
    category: text("category").notNull(),
    description: text("description").notNull(),
    classification: expenseClassification("classification")
      .notNull()
      .default("operating"),
    paidDate: date("paid_date").notNull(),
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("expenses_organization_id_unique").on(
      table.organizationId,
      table.id,
    ),
    check("expenses_amount_positive", sql`${table.amountCents} > 0`),
    foreignKey({
      columns: [table.organizationId, table.propertyId],
      foreignColumns: [properties.organizationId, properties.id],
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.organizationId, table.unitId],
      foreignColumns: [units.organizationId, units.id],
    }).onDelete("set null"),
  ],
);
