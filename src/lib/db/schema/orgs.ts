import {
  boolean,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

export const membershipRole = pgEnum("membership_role", ["owner", "staff"]);
export const invitationStatus = pgEnum("organization_invitation_status", ["pending", "accepted", "revoked", "expired"]);
export const joinRequestStatus = pgEnum("organization_join_request_status", ["pending", "approved", "rejected", "cancelled"]);

/** Stable keys used in API contracts. Labels and permissions live in tables. */
export const roleKey = pgEnum("organization_role_key", ["owner", "admin", "operations_manager", "staff"]);

/**
 * L1: StayOps operators. They act as an owner in every organization without
 * being a member of it, so they never show on a team list. Granted and
 * revoked only with `npm run l1 -- grant|revoke <email>`, never from the app.
 */
export const systemAdmins = pgTable("system_admins", {
  userId: text("user_id").primaryKey().references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Global, seeded roles. They are intentionally not organization-editable yet. */
export const roles = pgTable("roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: roleKey("key").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** One row per granted capability: the persisted permission matrix. */
export const rolePermissions = pgTable("role_permissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  roleId: uuid("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }),
  permission: text("permission").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("role_permissions_role_permission_unique").on(table.roleId, table.permission)]);

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  // Optional guest-facing name when it differs from the team's internal name.
  displayName: text("display_name"),
  logoUrl: text("logo_url"),
  slug: text("slug").notNull().unique(),
  // Used for organization-wide timestamps and as the initial timezone for new
  // properties. Each property's timezone remains the operational source of truth.
  defaultTimezone: text("default_timezone").notNull().default("Asia/Manila"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  addressLine1: text("address_line_1"),
  addressLine2: text("address_line_2"),
  city: text("city"),
  municipality: text("municipality"),
  province: text("province"),
  region: text("region"),
  country: text("country").notNull().default("Philippines"),
  // Kept temporarily for migration compatibility; new writes use structured
  // address fields above.
  businessAddress: text("business_address"),
  legalName: text("legal_name"),
  taxId: text("tax_id"),
  // Shown to guests on the private booking-status page (e.g. GCash number
  // and transfer instructions). Never displayed publicly.
  paymentInstructions: text("payment_instructions"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    roleId: uuid("role_id").notNull().references(() => roles.id, { onDelete: "restrict" }),
    // Kept during the migration window for backwards-compatible deployed
    // clients. New code reads roleId through the roles table.
    role: membershipRole("role").notNull().default("owner"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("memberships_organization_user_unique").on(
      table.organizationId,
      table.userId,
    ),
  ],
);

/** An owner-issued, email-bound invitation. Only its digest is persisted. */
export const organizationInvitations = pgTable("organization_invitations", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  roleId: uuid("role_id").notNull().references(() => roles.id, { onDelete: "restrict" }),
  codeHash: text("code_hash").notNull().unique(),
  status: invitationStatus("status").notNull().default("pending"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  invitedByUserId: text("invited_by_user_id").notNull().references(() => user.id, { onDelete: "restrict" }),
  acceptedByUserId: text("accepted_by_user_id").references(() => user.id, { onDelete: "set null" }),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("organization_invitations_email_status_idx").on(table.email, table.status)]);

/** Shareable organization codes create owner-approved join requests. */
export const organizationJoinCodes = pgTable("organization_join_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  codeHash: text("code_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdByUserId: text("created_by_user_id").notNull().references(() => user.id, { onDelete: "restrict" }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const organizationJoinRequests = pgTable("organization_join_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  requestedRoleId: uuid("requested_role_id").notNull().references(() => roles.id, { onDelete: "restrict" }),
  status: joinRequestStatus("status").notNull().default("pending"),
  reviewedByUserId: text("reviewed_by_user_id").references(() => user.id, { onDelete: "set null" }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("organization_join_requests_org_user_unique").on(table.organizationId, table.userId), index("organization_join_requests_org_status_idx").on(table.organizationId, table.status)]);

/**
 * An organization's changes to a role's default permissions (see
 * `src/lib/permissions.ts`). A permission without a row keeps its default, so
 * newly added permissions apply to every organization without a backfill.
 * The owner role is never overridden.
 */
export const organizationRolePermissions = pgTable("organization_role_permissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  roleId: uuid("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }),
  permission: text("permission").notNull(),
  allowed: boolean("allowed").notNull(),
  updatedByUserId: text("updated_by_user_id").references(() => user.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("organization_role_permissions_org_role_permission_unique").on(table.organizationId, table.roleId, table.permission)]);
