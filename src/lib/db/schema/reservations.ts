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
import { reservationFeeType, units } from "./inventory";

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
    // Optional profile details, kept for the team; never asked for when booking.
    preferredName: text("preferred_name"),
    birthDate: date("birth_date"),
    nationality: text("nationality"),
    idType: text("id_type"),
    idNumber: text("id_number"),
    address: text("address"),
    company: text("company"),
    // Tax identification number, for official receipts to companies.
    tin: text("tin"),
    emergencyContactName: text("emergency_contact_name"),
    emergencyContactPhone: text("emergency_contact_phone"),
    tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
    // Flagged guests warn the team before rebooking; the reason says why.
    flagged: boolean("flagged").notNull().default(false),
    flagReason: text("flag_reason"),
    marketingOptIn: boolean("marketing_opt_in").notNull().default(false),
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

/**
 * Where a booking came from: the organization's own channels (direct,
 * walk-in) and outside platforms like Airbnb. Defaults live in
 * `src/lib/platforms.ts`. Platforms are deactivated, not deleted, so past
 * reservations keep theirs.
 */
export const bookingPlatforms = pgTable(
  "booking_platforms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    // Stable key for the built-in platforms ("airbnb"); null for custom ones.
    key: text("key"),
    name: text("name").notNull(),
    logoUrl: text("logo_url"),
    websiteUrl: text("website_url"),
    // Hex brand color for badges, e.g. "#FF5A5F".
    color: text("color"),
    // The platform's cut of each booking, in basis points (1500 = 15%).
    commissionBasisPoints: integer("commission_basis_points"),
    // The platform takes the guest's payment itself (Airbnb, Agoda), so the
    // unit's reservation fee doesn't apply to its bookings.
    collectsPayment: boolean("collects_payment").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("booking_platforms_organization_id_unique").on(table.organizationId, table.id),
    uniqueIndex("booking_platforms_org_name_unique").on(table.organizationId, sql`lower(${table.name})`),
    uniqueIndex("booking_platforms_org_key_unique").on(table.organizationId, table.key),
    check("booking_platforms_name_length", sql`char_length(trim(${table.name})) BETWEEN 2 AND 60`),
    check(
      "booking_platforms_commission_check",
      sql`${table.commissionBasisPoints} IS NULL OR ${table.commissionBasisPoints} BETWEEN 0 AND 10000`,
    ),
  ],
);

export type BookingPlatform = typeof bookingPlatforms.$inferSelect;

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
    // The unit's reservation fee rule, copied when the booking is made (null
    // when none applies, e.g. an Airbnb booking). The required amount follows
    // the current charges; see src/lib/reservation-fee.ts.
    reservationFeeType: reservationFeeType("reservation_fee_type"),
    reservationFeeAmount: integer("reservation_fee_amount"),
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
    // Where the booking came from; null for reservations made before
    // platforms existed.
    platformId: uuid("platform_id"),
    // The platform's own confirmation code, e.g. an Airbnb "HMABC123".
    platformReference: text("platform_reference"),
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
    foreignKey({
      columns: [table.organizationId, table.platformId],
      foreignColumns: [bookingPlatforms.organizationId, bookingPlatforms.id],
    }),
    check(
      "reservations_range_check",
      sql`${table.checkOutDate} > ${table.checkInDate}`,
    ),
    check(
      "reservations_reservation_fee_check",
      sql`(${table.reservationFeeType} IS NULL) = (${table.reservationFeeAmount} IS NULL)`,
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
