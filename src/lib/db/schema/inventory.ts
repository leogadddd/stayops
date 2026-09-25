import { sql } from "drizzle-orm";
import {
  check,
  date,
  foreignKey,
  integer,
  jsonb,
  index,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { organizations } from "./orgs";
import { DEFAULT_CHECKLIST, type ChecklistTemplateItem } from "@/lib/turnover";

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
    // Default duration for the automatic turnover block opened at checkout.
    turnoverDurationMinutes: integer("turnover_duration_minutes")
      .notNull()
      .default(120),
    houseRules: text("house_rules"),
    // A small, self-contained cover photo uploaded by the owner.
    imageUrl: text("image_url"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    // Composite target for units' cross-organization guard foreign key.
    uniqueIndex("properties_organization_id_unique").on(
      table.organizationId,
      table.id,
    ),
    index("properties_org_active_idx").on(table.organizationId, table.deletedAt),
    check(
      "properties_turnover_duration_positive",
      sql`${table.turnoverDurationMinutes} >= 1 AND ${table.turnoverDurationMinutes} <= 1440`,
    ),
  ],
);

export type Unit = typeof units.$inferSelect;

/**
 * Frozen PRD default used as the column default; labels contain no single
 * quotes, so embedding the JSON in a SQL literal is safe.
 */
const DEFAULT_CHECKLIST_SQL = sql.raw(
  `'${JSON.stringify(DEFAULT_CHECKLIST)}'::jsonb`,
);

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
    checkInTime: text("check_in_time").notNull().default("15:00"),
    checkOutTime: text("check_out_time").notNull().default("11:00"),
    status: unitStatus("status").notNull().default("renovating"),
    // A small, self-contained cover photo uploaded by the owner.
    imageUrl: text("image_url"),
    // Turnover template snapshot source; checkout copies it onto the task.
    checklistTemplate: jsonb("checklist_template")
      .$type<ChecklistTemplateItem[]>()
      .notNull()
      .default(DEFAULT_CHECKLIST_SQL),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("units_organization_id_unique").on(
      table.organizationId,
      table.id,
    ),
    index("units_org_active_idx").on(table.organizationId, table.deletedAt),
    index("units_property_active_idx").on(table.propertyId, table.deletedAt),
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

export const AMENITY_SCOPES = ["property", "unit"] as const;
export type AmenityScope = (typeof AMENITY_SCOPES)[number];
export const amenityScope = pgEnum("amenity_scope", AMENITY_SCOPES);

/**
 * An organization's amenity catalog. Property amenities describe the building
 * (pool, parking); unit amenities describe what's inside a unit (towels,
 * kitchen tools). Defaults are seeded per organization; owners add their own.
 */
export const amenities = pgTable(
  "amenities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    scope: amenityScope("scope").notNull(),
    name: text("name").notNull(),
    // Icon key understood by the amenity picker; null for custom amenities.
    icon: text("icon"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("amenities_organization_id_unique").on(table.organizationId, table.id),
    uniqueIndex("amenities_org_scope_name_unique").on(table.organizationId, table.scope, sql`lower(${table.name})`),
    check("amenities_name_length", sql`char_length(trim(${table.name})) BETWEEN 2 AND 60`),
  ],
);

export type Amenity = typeof amenities.$inferSelect;

export const propertyAmenities = pgTable(
  "property_amenities",
  {
    organizationId: uuid("organization_id").notNull(),
    propertyId: uuid("property_id").notNull(),
    amenityId: uuid("amenity_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.propertyId, table.amenityId] }),
    index("property_amenities_amenity_idx").on(table.amenityId),
    foreignKey({
      name: "property_amenities_property_fk",
      columns: [table.organizationId, table.propertyId],
      foreignColumns: [properties.organizationId, properties.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "property_amenities_amenity_fk",
      columns: [table.organizationId, table.amenityId],
      foreignColumns: [amenities.organizationId, amenities.id],
    }).onDelete("cascade"),
  ],
);

export const unitAmenities = pgTable(
  "unit_amenities",
  {
    organizationId: uuid("organization_id").notNull(),
    unitId: uuid("unit_id").notNull(),
    amenityId: uuid("amenity_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.unitId, table.amenityId] }),
    index("unit_amenities_amenity_idx").on(table.amenityId),
    foreignKey({
      name: "unit_amenities_unit_fk",
      columns: [table.organizationId, table.unitId],
      foreignColumns: [units.organizationId, units.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "unit_amenities_amenity_fk",
      columns: [table.organizationId, table.amenityId],
      foreignColumns: [amenities.organizationId, amenities.id],
    }).onDelete("cascade"),
  ],
);
