CREATE TYPE "public"."amenity_scope" AS ENUM('property', 'unit');--> statement-breakpoint
CREATE TABLE "amenities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"scope" "amenity_scope" NOT NULL,
	"name" text NOT NULL,
	"icon" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "amenities_name_length" CHECK (char_length(trim("amenities"."name")) BETWEEN 2 AND 60)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "amenities_organization_id_unique" ON "amenities" USING btree ("organization_id","id");--> statement-breakpoint
CREATE TABLE "property_amenities" (
	"organization_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"amenity_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "property_amenities_property_id_amenity_id_pk" PRIMARY KEY("property_id","amenity_id")
);
--> statement-breakpoint
CREATE TABLE "unit_amenities" (
	"organization_id" uuid NOT NULL,
	"unit_id" uuid NOT NULL,
	"amenity_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unit_amenities_unit_id_amenity_id_pk" PRIMARY KEY("unit_id","amenity_id")
);
--> statement-breakpoint
ALTER TABLE "amenities" ADD CONSTRAINT "amenities_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_amenities" ADD CONSTRAINT "property_amenities_property_fk" FOREIGN KEY ("organization_id","property_id") REFERENCES "public"."properties"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_amenities" ADD CONSTRAINT "property_amenities_amenity_fk" FOREIGN KEY ("organization_id","amenity_id") REFERENCES "public"."amenities"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_amenities" ADD CONSTRAINT "unit_amenities_unit_fk" FOREIGN KEY ("organization_id","unit_id") REFERENCES "public"."units"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_amenities" ADD CONSTRAINT "unit_amenities_amenity_fk" FOREIGN KEY ("organization_id","amenity_id") REFERENCES "public"."amenities"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "amenities_org_scope_name_unique" ON "amenities" USING btree ("organization_id","scope",lower("name"));--> statement-breakpoint
CREATE INDEX "property_amenities_amenity_idx" ON "property_amenities" USING btree ("amenity_id");--> statement-breakpoint
CREATE INDEX "unit_amenities_amenity_idx" ON "unit_amenities" USING btree ("amenity_id");