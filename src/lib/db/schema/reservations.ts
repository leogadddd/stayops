import { sql } from "drizzle-orm";
import {
  boolean,
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
import { units } from "./inventory";

export const RESERVATION_STATUSES = [
  "hold",
  "confirmed",
  "checked_in",
  "checked_out",
  "cancelled",
  "expired",
] as const;

export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

export const reservationStatus = pgEnum(
  "reservation_status",
  RESERVATION_STATUSES,
);

export const CHARGE_TYPES = [
  "accommodation",
  "cleaning",
  "fee",
  "discount",
  "security_deposit",
] as const;

export type ChargeType = (typeof CHARGE_TYPES)[number];

export const chargeType = pgEnum("charge_type", CHARGE_TYPES);

export const guests = pgTable(
  "guests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("guests_organization_id_unique").on(
      table.organizationId,
      table.id,
    ),
    check(
      "guests_contact_check",
      sql`${table.email} IS NOT NULL OR ${table.phone} IS NOT NULL`,
    ),
  ],
);

export const reservations = pgTable(
  "reservations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    unitId: uuid("unit_id").notNull(),
    guestId: uuid("guest_id").notNull(),
    checkInDate: date("check_in_date").notNull(),
    checkOutDate: date("check_out_date").notNull(),
    status: reservationStatus("status").notNull().default("hold"),
    guestCount: integer("guest_count").notNull().default(1),
    // Holds reserve dates until this UTC timestamp; null for non-holds.
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    // Owner-supplied reason when confirming without the required payment.
    confirmReason: text("confirm_reason"),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelReason: text("cancel_reason"),
    // The real departure timestamp drives the automatic turnover window.
    actualCheckoutAt: timestamp("actual_checkout_at", { withTimezone: true }),
    // Client-generated key: retried creates with the same key return the
    // existing reservation instead of inserting a duplicate.
    idempotencyKey: text("idempotency_key"),
    source: text("source").notNull().default("direct"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("reservations_organization_id_unique").on(
      table.organizationId,
      table.id,
    ),
    uniqueIndex("reservations_idempotency_unique").on(
      table.organizationId,
      table.idempotencyKey,
    ),
    foreignKey({
      columns: [table.organizationId, table.unitId],
      foreignColumns: [units.organizationId, units.id],
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.organizationId, table.guestId],
      foreignColumns: [guests.organizationId, guests.id],
    }).onDelete("cascade"),
    check(
      "reservations_range_check",
      sql`${table.checkOutDate} > ${table.checkInDate}`,
    ),
    check(
      "reservations_guest_count_check",
      sql`${table.guestCount} >= 1`,
    ),
  ],
);

/**
 * Additional people staying under a reservation. They are intentionally not
 * guest profiles: they have no contact/booking history and exist only for
 * occupancy lists, access letters, and contracts for this particular stay.
 */
export const reservationOccupants = pgTable(
  "reservation_occupants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    reservationId: uuid("reservation_id").notNull(),
    name: text("name").notNull(),
    position: integer("position").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("reservation_occupants_organization_id_unique").on(table.organizationId, table.id),
    uniqueIndex("reservation_occupants_reservation_position_unique").on(table.reservationId, table.position),
    foreignKey({
      columns: [table.organizationId, table.reservationId],
      foreignColumns: [reservations.organizationId, reservations.id],
    }).onDelete("cascade"),
    check("reservation_occupants_name_check", sql`char_length(trim(${table.name})) > 0`),
    check("reservation_occupants_position_check", sql`${table.position} >= 0`),
  ],
);

/**
 * The agreed price snapshot. Accommodation rows carry quantity = nights and
 * unitAmount = the negotiated nightly rate; discount rows store negative
 * centavos so a plain sum yields the booking total. Security deposit rows
 * are refundable and never part of booking revenue.
 */
export const reservationCharges = pgTable(
  "reservation_charges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    reservationId: uuid("reservation_id").notNull(),
    type: chargeType("type").notNull(),
    description: text("description").notNull(),
    quantity: integer("quantity").notNull().default(1),
    unitAmountCents: integer("unit_amount_cents").notNull(),
    amountCents: integer("amount_cents").notNull(),
    isRefundableDeposit: boolean("is_refundable_deposit")
      .notNull()
      .default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("reservation_charges_organization_id_unique").on(
      table.organizationId,
      table.id,
    ),
    foreignKey({
      columns: [table.organizationId, table.reservationId],
      foreignColumns: [reservations.organizationId, reservations.id],
    }).onDelete("cascade"),
    check(
      "reservation_charges_amount_check",
      sql`${table.amountCents} = ${table.quantity} * ${table.unitAmountCents}`,
    ),
  ],
);

export const reservationTransitions = pgTable(
  "reservation_transitions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    reservationId: uuid("reservation_id").notNull(),
    fromStatus: reservationStatus("from_status"),
    toStatus: reservationStatus("to_status").notNull(),
    note: text("note"),
    actorUserId: text("actor_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("reservation_transitions_organization_id_unique").on(
      table.organizationId,
      table.id,
    ),
    foreignKey({
      columns: [table.organizationId, table.reservationId],
      foreignColumns: [reservations.organizationId, reservations.id],
    }).onDelete("cascade"),
  ],
);

/**
 * Guest booking-status links. Only the SHA-256 hash of the token is stored;
 * the raw token appears solely in the URL the owner copies and sends.
 */
export const accessTokens = pgTable(
  "access_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    reservationId: uuid("reservation_id").notNull(),
    tokenHash: text("token_hash").notNull(),
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("access_tokens_token_hash_unique").on(table.tokenHash),
    uniqueIndex("access_tokens_organization_id_unique").on(
      table.organizationId,
      table.id,
    ),
    foreignKey({
      columns: [table.organizationId, table.reservationId],
      foreignColumns: [reservations.organizationId, reservations.id],
    }).onDelete("cascade"),
  ],
);
