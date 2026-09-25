import {
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

export const membershipRole = pgEnum("membership_role", ["owner", "staff"]);

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
