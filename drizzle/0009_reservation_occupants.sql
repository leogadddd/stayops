CREATE TABLE "reservation_occupants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"reservation_id" uuid NOT NULL,
	"name" text NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reservation_occupants_name_check" CHECK (char_length(trim("reservation_occupants"."name")) > 0),
	CONSTRAINT "reservation_occupants_position_check" CHECK ("reservation_occupants"."position" >= 0)
);--> statement-breakpoint
ALTER TABLE "reservation_occupants" ADD CONSTRAINT "reservation_occupants_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservation_occupants" ADD CONSTRAINT "reservation_occupants_organization_id_reservation_id_reservations_organization_id_id_fk" FOREIGN KEY ("organization_id","reservation_id") REFERENCES "public"."reservations"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "reservation_occupants_organization_id_unique" ON "reservation_occupants" USING btree ("organization_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "reservation_occupants_reservation_position_unique" ON "reservation_occupants" USING btree ("reservation_id","position");
