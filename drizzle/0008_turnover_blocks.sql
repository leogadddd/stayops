ALTER TABLE "properties" ADD COLUMN "turnover_duration_minutes" integer DEFAULT 120 NOT NULL;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_turnover_duration_positive" CHECK ("properties"."turnover_duration_minutes" >= 1 AND "properties"."turnover_duration_minutes" <= 1440);--> statement-breakpoint
CREATE TABLE "turnover_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"unit_id" uuid NOT NULL,
	"reservation_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"duration_minutes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "turnover_blocks_reservation_unique" UNIQUE("reservation_id"),
	CONSTRAINT "turnover_blocks_range_check" CHECK ("turnover_blocks"."ends_at" > "turnover_blocks"."starts_at"),
	CONSTRAINT "turnover_blocks_duration_check" CHECK ("turnover_blocks"."duration_minutes" >= 1 AND "turnover_blocks"."duration_minutes" <= 1440)
);--> statement-breakpoint
ALTER TABLE "turnover_blocks" ADD CONSTRAINT "turnover_blocks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "turnover_blocks" ADD CONSTRAINT "turnover_blocks_organization_id_unit_id_units_organization_id_id_fk" FOREIGN KEY ("organization_id","unit_id") REFERENCES "public"."units"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "turnover_blocks" ADD CONSTRAINT "turnover_blocks_organization_id_reservation_id_reservations_organization_id_id_fk" FOREIGN KEY ("organization_id","reservation_id") REFERENCES "public"."reservations"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "turnover_blocks" ADD CONSTRAINT "turnover_blocks_organization_id_task_id_tasks_organization_id_id_fk" FOREIGN KEY ("organization_id","task_id") REFERENCES "public"."tasks"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "turnover_blocks_unit_time_idx" ON "turnover_blocks" USING btree ("unit_id","starts_at","ends_at");
