import { sql } from "drizzle-orm";
import {
  check,
  date,
  foreignKey,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { organizations } from "./orgs";

export const UNIT_STATUSES = [
  "renovating",
  "furnishing",
  "ready_to_list",
  "active",
  "maintenance",
  "inactive",
] as const;

export type UnitStatus = (typeof UNIT_STATUSES)[number];

export const unitStatus = pgEnum("unit_status", UNIT_STATUSES);

export const properties = pgTable(
  "properties",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    address: text("address"),
    timezone: text("timezone").notNull().default("Asia/Manila"),
    checkInTime: text("check_in_time").notNull().default("15:00"),
    checkOutTime: text("check_out_time").notNull().default("11:00"),
    houseRules: text("house_rules"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Composite target for units' cross-organization guard foreign key.
    uniqueIndex("properties_organization_id_unique").on(
      table.organizationId,
      table.id,
    ),
  ],
);

export type Unit = typeof units.$inferSelect;

export const units = pgTable(
  "units",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    propertyId: uuid("property_id").notNull(),
    name: text("name").notNull(),
    capacity: integer("capacity").notNull().default(2),
    bedrooms: integer("bedrooms").notNull().default(0),
    bathrooms: numeric("bathrooms", { precision: 3, scale: 1, mode: "number" })
      .notNull()
      .default(1),
    defaultNightlyRateCents: integer("default_nightly_rate_cents")
      .notNull()
      .default(0),
    cleaningFeeCents: integer("cleaning_fee_cents"),
    securityDepositCents: integer("security_deposit_cents"),
    status: unitStatus("status").notNull().default("renovating"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("units_organization_id_unique").on(
      table.organizationId,
      table.id,
    ),
    foreignKey({
      columns: [table.organizationId, table.propertyId],
      foreignColumns: [properties.organizationId, properties.id],
    }).onDelete("cascade"),
    check(
      "units_rates_nonnegative",
      sql`${table.defaultNightlyRateCents} >= 0
        AND (${table.cleaningFeeCents} IS NULL OR ${table.cleaningFeeCents} >= 0)
        AND (${table.securityDepositCents} IS NULL OR ${table.securityDepositCents} >= 0)`,
    ),
    check(
      "units_capacity_positive",
      sql`${table.capacity} >= 1 AND ${table.bedrooms} >= 0 AND ${table.bathrooms} > 0`,
    ),
  ],
);

export const unitBlocks = pgTable(
  "unit_blocks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    unitId: uuid("unit_id").notNull(),
    // Half-open local date range: [startDate, endDate).
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    reason: text("reason").notNull(),
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("unit_blocks_organization_id_unique").on(
      table.organizationId,
      table.id,
    ),
    foreignKey({
      columns: [table.organizationId, table.unitId],
      foreignColumns: [units.organizationId, units.id],
    }).onDelete("cascade"),
    check(
      "unit_blocks_range_check",
      sql`${table.endDate} > ${table.startDate}`,
    ),
  ],
);
