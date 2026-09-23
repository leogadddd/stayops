CREATE TYPE "public"."charge_type" AS ENUM('accommodation', 'cleaning', 'fee', 'discount', 'security_deposit');--> statement-breakpoint
CREATE TYPE "public"."reservation_status" AS ENUM('hold', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'expired');--> statement-breakpoint
CREATE TABLE "access_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"reservation_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"created_by" text,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "guests_contact_check" CHECK ("guests"."email" IS NOT NULL OR "guests"."phone" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "reservation_charges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"reservation_id" uuid NOT NULL,
	"type" charge_type NOT NULL,
	"description" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_amount_cents" integer NOT NULL,
	"amount_cents" integer NOT NULL,
	"is_refundable_deposit" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reservation_charges_amount_check" CHECK ("reservation_charges"."amount_cents" = "reservation_charges"."quantity" * "reservation_charges"."unit_amount_cents")
);
--> statement-breakpoint
CREATE TABLE "reservation_transitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"reservation_id" uuid NOT NULL,
	"from_status" "reservation_status",
	"to_status" "reservation_status" NOT NULL,
	"note" text,
	"actor_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"unit_id" uuid NOT NULL,
	"guest_id" uuid NOT NULL,
	"check_in_date" date NOT NULL,
	"check_out_date" date NOT NULL,
	"status" "reservation_status" DEFAULT 'hold' NOT NULL,
	"guest_count" integer DEFAULT 1 NOT NULL,
	"expires_at" timestamp with time zone,
	"confirm_reason" text,
	"cancelled_at" timestamp with time zone,
	"cancel_reason" text,
	"idempotency_key" text,
	"source" text DEFAULT 'direct' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reservations_range_check" CHECK ("reservations"."check_out_date" > "reservations"."check_in_date"),
	CONSTRAINT "reservations_guest_count_check" CHECK ("reservations"."guest_count" >= 1)
);
--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "payment_instructions" text;--> statement-breakpoint
CREATE UNIQUE INDEX "reservations_idempotency_unique" ON "reservations" USING btree ("organization_id","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "access_tokens_token_hash_unique" ON "access_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "access_tokens_organization_id_unique" ON "access_tokens" USING btree ("organization_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "guests_organization_id_unique" ON "guests" USING btree ("organization_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "reservation_charges_organization_id_unique" ON "reservation_charges" USING btree ("organization_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "reservation_transitions_organization_id_unique" ON "reservation_transitions" USING btree ("organization_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "reservations_organization_id_unique" ON "reservations" USING btree ("organization_id","id");--> statement-breakpoint
ALTER TABLE "access_tokens" ADD CONSTRAINT "access_tokens_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_tokens" ADD CONSTRAINT "access_tokens_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_tokens" ADD CONSTRAINT "access_tokens_organization_id_reservation_id_reservations_organization_id_id_fk" FOREIGN KEY ("organization_id","reservation_id") REFERENCES "public"."reservations"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guests" ADD CONSTRAINT "guests_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservation_charges" ADD CONSTRAINT "reservation_charges_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservation_charges" ADD CONSTRAINT "reservation_charges_organization_id_reservation_id_reservations_organization_id_id_fk" FOREIGN KEY ("organization_id","reservation_id") REFERENCES "public"."reservations"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservation_transitions" ADD CONSTRAINT "reservation_transitions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservation_transitions" ADD CONSTRAINT "reservation_transitions_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservation_transitions" ADD CONSTRAINT "reservation_transitions_organization_id_reservation_id_reservations_organization_id_id_fk" FOREIGN KEY ("organization_id","reservation_id") REFERENCES "public"."reservations"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_organization_id_unit_id_units_organization_id_id_fk" FOREIGN KEY ("organization_id","unit_id") REFERENCES "public"."units"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_organization_id_guest_id_guests_organization_id_id_fk" FOREIGN KEY ("organization_id","guest_id") REFERENCES "public"."guests"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS btree_gist;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_no_active_overlap" EXCLUDE USING gist ("unit_id" WITH =, daterange("check_in_date", "check_out_date", '[)') WITH &&) WHERE ("reservations"."status" IN ('hold','confirmed','checked_in','checked_out'));