CREATE TYPE "public"."damage_status" AS ENUM('open', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('open', 'ready');--> statement-breakpoint
CREATE TABLE "damage_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"unit_id" uuid NOT NULL,
	"reservation_id" uuid,
	"description" text NOT NULL,
	"estimated_amount_cents" integer,
	"actual_amount_cents" integer,
	"status" "damage_status" DEFAULT 'open' NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by" text,
	"resolution_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "damage_reports_organization_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "damage_reports_description_check" CHECK (char_length(trim("damage_reports"."description")) > 0),
	CONSTRAINT "damage_reports_estimated_check" CHECK ("damage_reports"."estimated_amount_cents" IS NULL OR "damage_reports"."estimated_amount_cents" > 0),
	CONSTRAINT "damage_reports_actual_check" CHECK ("damage_reports"."actual_amount_cents" IS NULL OR "damage_reports"."actual_amount_cents" > 0)
);
--> statement-breakpoint
CREATE TABLE "task_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"label" text NOT NULL,
	"required" boolean DEFAULT true NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"completed_at" timestamp with time zone,
	"completed_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_items_organization_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "task_items_label_check" CHECK (char_length(trim("task_items"."label")) > 0),
	CONSTRAINT "task_items_position_check" CHECK ("task_items"."position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"unit_id" uuid NOT NULL,
	"reservation_id" uuid,
	"status" "task_status" DEFAULT 'open' NOT NULL,
	"checklist_snapshot" jsonb NOT NULL,
	"notes" text,
	"marked_ready_at" timestamp with time zone,
	"marked_ready_by" text,
	"ready_override_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tasks_organization_id_unique" UNIQUE("organization_id","id")
);
--> statement-breakpoint
ALTER TABLE "units" ADD COLUMN "checklist_template" jsonb DEFAULT '[{"label":"Change bedsheets","required":true},{"label":"Replace towels","required":true},{"label":"Clean bathroom","required":true},{"label":"Clean kitchen","required":true},{"label":"Clean fridge","required":true},{"label":"Take out rubbish","required":true},{"label":"Restock toiletries","required":true},{"label":"Check Wi-Fi","required":true},{"label":"Check aircon","required":true},{"label":"Damage inspection","required":true}]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "damage_reports" ADD CONSTRAINT "damage_reports_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "damage_reports" ADD CONSTRAINT "damage_reports_resolved_by_user_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "damage_reports" ADD CONSTRAINT "damage_reports_organization_id_unit_id_units_organization_id_id_fk" FOREIGN KEY ("organization_id","unit_id") REFERENCES "public"."units"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "damage_reports" ADD CONSTRAINT "damage_reports_organization_id_reservation_id_reservations_organization_id_id_fk" FOREIGN KEY ("organization_id","reservation_id") REFERENCES "public"."reservations"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_items" ADD CONSTRAINT "task_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_items" ADD CONSTRAINT "task_items_completed_by_user_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_items" ADD CONSTRAINT "task_items_organization_id_task_id_tasks_organization_id_id_fk" FOREIGN KEY ("organization_id","task_id") REFERENCES "public"."tasks"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_marked_ready_by_user_id_fk" FOREIGN KEY ("marked_ready_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_organization_id_unit_id_units_organization_id_id_fk" FOREIGN KEY ("organization_id","unit_id") REFERENCES "public"."units"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_organization_id_reservation_id_reservations_organization_id_id_fk" FOREIGN KEY ("organization_id","reservation_id") REFERENCES "public"."reservations"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deposit_deductions" ADD CONSTRAINT "deposit_deductions_organization_id_damage_report_id_damage_reports_organization_id_id_fk" FOREIGN KEY ("organization_id","damage_report_id") REFERENCES "public"."damage_reports"("organization_id","id") ON DELETE set null ON UPDATE no action;