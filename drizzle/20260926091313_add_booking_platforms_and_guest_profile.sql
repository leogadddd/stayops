CREATE TABLE "booking_platforms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"key" text,
	"name" text NOT NULL,
	"logo_url" text,
	"website_url" text,
	"color" text,
	"commission_basis_points" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "booking_platforms_name_length" CHECK (char_length(trim("booking_platforms"."name")) BETWEEN 2 AND 60),
	CONSTRAINT "booking_platforms_commission_check" CHECK ("booking_platforms"."commission_basis_points" IS NULL OR "booking_platforms"."commission_basis_points" BETWEEN 0 AND 10000)
);
--> statement-breakpoint
ALTER TABLE "guests" ADD COLUMN "preferred_name" text;--> statement-breakpoint
ALTER TABLE "guests" ADD COLUMN "birth_date" date;--> statement-breakpoint
ALTER TABLE "guests" ADD COLUMN "nationality" text;--> statement-breakpoint
ALTER TABLE "guests" ADD COLUMN "id_type" text;--> statement-breakpoint
ALTER TABLE "guests" ADD COLUMN "id_number" text;--> statement-breakpoint
ALTER TABLE "guests" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "guests" ADD COLUMN "company" text;--> statement-breakpoint
ALTER TABLE "guests" ADD COLUMN "tin" text;--> statement-breakpoint
ALTER TABLE "guests" ADD COLUMN "emergency_contact_name" text;--> statement-breakpoint
ALTER TABLE "guests" ADD COLUMN "emergency_contact_phone" text;--> statement-breakpoint
ALTER TABLE "guests" ADD COLUMN "tags" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "guests" ADD COLUMN "flagged" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "guests" ADD COLUMN "flag_reason" text;--> statement-breakpoint
ALTER TABLE "guests" ADD COLUMN "marketing_opt_in" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN "platform_id" uuid;--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN "platform_reference" text;--> statement-breakpoint
ALTER TABLE "booking_platforms" ADD CONSTRAINT "booking_platforms_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "booking_platforms_organization_id_unique" ON "booking_platforms" USING btree ("organization_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "booking_platforms_org_name_unique" ON "booking_platforms" USING btree ("organization_id",lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "booking_platforms_org_key_unique" ON "booking_platforms" USING btree ("organization_id","key");--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_organization_id_platform_id_booking_platforms_organization_id_id_fk" FOREIGN KEY ("organization_id","platform_id") REFERENCES "public"."booking_platforms"("organization_id","id") ON DELETE no action ON UPDATE no action;