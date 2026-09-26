CREATE TYPE "public"."organization_invitation_status" AS ENUM('pending', 'accepted', 'revoked', 'expired');--> statement-breakpoint
CREATE TYPE "public"."organization_join_request_status" AS ENUM('pending', 'approved', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."organization_role_key" AS ENUM('owner', 'admin', 'operations_manager', 'staff');--> statement-breakpoint
CREATE TABLE "organization_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role_id" uuid NOT NULL,
	"code_hash" text NOT NULL,
	"status" "organization_invitation_status" DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"invited_by_user_id" text NOT NULL,
	"accepted_by_user_id" text,
	"accepted_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_invitations_code_hash_unique" UNIQUE("code_hash")
);
--> statement-breakpoint
CREATE TABLE "organization_join_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"code_hash" text NOT NULL,
	"expires_at" timestamp with time zone,
	"created_by_user_id" text NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_join_codes_code_hash_unique" UNIQUE("code_hash")
);
--> statement-breakpoint
CREATE TABLE "organization_join_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"requested_role_id" uuid NOT NULL,
	"status" "organization_join_request_status" DEFAULT 'pending' NOT NULL,
	"reviewed_by_user_id" text,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role_id" uuid NOT NULL,
	"permission" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" "organization_role_key" NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roles_key_unique" UNIQUE("key")
);
--> statement-breakpoint
INSERT INTO "roles" ("key", "name", "description") VALUES
  ('owner', 'Owner', 'Full control, including billing and ownership-sensitive settings.'),
  ('admin', 'Admin', 'Runs the organization and team, excluding billing and ownership.'),
  ('operations_manager', 'Operations Manager', 'Manages properties, stays, inventory, tasks, and expenses.'),
  ('staff', 'Staff', 'Handles day-to-day tasks and operational updates.');
--> statement-breakpoint
INSERT INTO "role_permissions" ("role_id", "permission")
SELECT "id", permission
FROM "roles"
CROSS JOIN LATERAL (
  VALUES
    ('organization.manage'), ('team.manage'), ('billing.manage'), ('reports.view'), ('properties.manage'), ('reservations.manage'), ('expenses.manage'), ('operations.manage'), ('inventory.manage')
) AS permissions(permission)
WHERE "key" = 'owner';
--> statement-breakpoint
INSERT INTO "role_permissions" ("role_id", "permission")
SELECT "id", permission
FROM "roles"
CROSS JOIN LATERAL (
  VALUES
    ('organization.manage'), ('team.manage'), ('reports.view'), ('properties.manage'), ('reservations.manage'), ('expenses.manage'), ('operations.manage'), ('inventory.manage')
) AS permissions(permission)
WHERE "key" = 'admin';
--> statement-breakpoint
INSERT INTO "role_permissions" ("role_id", "permission")
SELECT "id", permission
FROM "roles"
CROSS JOIN LATERAL (
  VALUES
    ('properties.manage'), ('reservations.manage'), ('expenses.manage'), ('operations.manage'), ('inventory.manage')
) AS permissions(permission)
WHERE "key" = 'operations_manager';
--> statement-breakpoint
INSERT INTO "role_permissions" ("role_id", "permission")
SELECT "id", 'operations.manage' FROM "roles" WHERE "key" = 'staff';
--> statement-breakpoint
ALTER TABLE "memberships" ADD COLUMN "role_id" uuid;--> statement-breakpoint
UPDATE "memberships" SET "role_id" = "roles"."id"
FROM "roles"
WHERE "roles"."key"::text = "memberships"."role"::text;
--> statement-breakpoint
ALTER TABLE "organization_invitations" ADD CONSTRAINT "organization_invitations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_invitations" ADD CONSTRAINT "organization_invitations_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_invitations" ADD CONSTRAINT "organization_invitations_invited_by_user_id_user_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_invitations" ADD CONSTRAINT "organization_invitations_accepted_by_user_id_user_id_fk" FOREIGN KEY ("accepted_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_join_codes" ADD CONSTRAINT "organization_join_codes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_join_codes" ADD CONSTRAINT "organization_join_codes_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_join_requests" ADD CONSTRAINT "organization_join_requests_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_join_requests" ADD CONSTRAINT "organization_join_requests_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_join_requests" ADD CONSTRAINT "organization_join_requests_requested_role_id_roles_id_fk" FOREIGN KEY ("requested_role_id") REFERENCES "public"."roles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_join_requests" ADD CONSTRAINT "organization_join_requests_reviewed_by_user_id_user_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "organization_invitations_email_status_idx" ON "organization_invitations" USING btree ("email","status");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_join_requests_org_user_unique" ON "organization_join_requests" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "organization_join_requests_org_status_idx" ON "organization_join_requests" USING btree ("organization_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "role_permissions_role_permission_unique" ON "role_permissions" USING btree ("role_id","permission");--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE restrict ON UPDATE no action;
