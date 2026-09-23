CREATE TYPE "public"."unit_status" AS ENUM('renovating', 'furnishing', 'ready_to_list', 'active', 'maintenance', 'inactive');--> statement-breakpoint
CREATE TABLE "properties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"timezone" text DEFAULT 'Asia/Manila' NOT NULL,
	"check_in_time" text DEFAULT '15:00' NOT NULL,
	"check_out_time" text DEFAULT '11:00' NOT NULL,
	"house_rules" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "unit_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"unit_id" uuid NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"reason" text NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unit_blocks_range_check" CHECK ("unit_blocks"."end_date" > "unit_blocks"."start_date")
);
--> statement-breakpoint
CREATE TABLE "units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"name" text NOT NULL,
	"capacity" integer DEFAULT 2 NOT NULL,
	"bedrooms" integer DEFAULT 0 NOT NULL,
	"bathrooms" numeric(3, 1) DEFAULT 1 NOT NULL,
	"default_nightly_rate_cents" integer DEFAULT 0 NOT NULL,
	"cleaning_fee_cents" integer,
	"security_deposit_cents" integer,
	"status" "unit_status" DEFAULT 'renovating' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "units_rates_nonnegative" CHECK ("units"."default_nightly_rate_cents" >= 0
        AND ("units"."cleaning_fee_cents" IS NULL OR "units"."cleaning_fee_cents" >= 0)
        AND ("units"."security_deposit_cents" IS NULL OR "units"."security_deposit_cents" >= 0)),
	CONSTRAINT "units_capacity_positive" CHECK ("units"."capacity" >= 1 AND "units"."bedrooms" >= 0 AND "units"."bathrooms" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "properties_organization_id_unique" ON "properties" USING btree ("organization_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "unit_blocks_organization_id_unique" ON "unit_blocks" USING btree ("organization_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "units_organization_id_unique" ON "units" USING btree ("organization_id","id");--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_blocks" ADD CONSTRAINT "unit_blocks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_blocks" ADD CONSTRAINT "unit_blocks_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_blocks" ADD CONSTRAINT "unit_blocks_organization_id_unit_id_units_organization_id_id_fk" FOREIGN KEY ("organization_id","unit_id") REFERENCES "public"."units"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "units" ADD CONSTRAINT "units_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "units" ADD CONSTRAINT "units_organization_id_property_id_properties_organization_id_id_fk" FOREIGN KEY ("organization_id","property_id") REFERENCES "public"."properties"("organization_id","id") ON DELETE cascade ON UPDATE no action;