CREATE TYPE "public"."expense_classification" AS ENUM('operating', 'capital');--> statement-breakpoint
CREATE TYPE "public"."payment_allocation" AS ENUM('booking', 'security_deposit');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('gcash', 'maya', 'bank_transfer', 'cash');--> statement-breakpoint
CREATE TYPE "public"."proof_status" AS ENUM('unverified', 'recorded', 'dismissed');--> statement-breakpoint
CREATE TABLE "deposit_deductions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"reservation_id" uuid NOT NULL,
	"amount_cents" integer NOT NULL,
	"reason" text NOT NULL,
	"damage_report_id" uuid,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deposit_deductions_amount_positive" CHECK ("deposit_deductions"."amount_cents" > 0)
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"unit_id" uuid,
	"amount_cents" integer NOT NULL,
	"category" text NOT NULL,
	"description" text NOT NULL,
	"classification" "expense_classification" DEFAULT 'operating' NOT NULL,
	"paid_date" date NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "expenses_amount_positive" CHECK ("expenses"."amount_cents" > 0)
);
--> statement-breakpoint
CREATE TABLE "payment_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"reservation_id" uuid NOT NULL,
	"allocation" "payment_allocation" NOT NULL,
	"amount_cents" integer NOT NULL,
	"method" "payment_method" NOT NULL,
	"reference" text,
	"received_at" timestamp with time zone NOT NULL,
	"recorded_by" text,
	"reversal_of_id" uuid,
	"idempotency_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_proofs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"reservation_id" uuid NOT NULL,
	"reference" text NOT NULL,
	"note" text,
	"status" "proof_status" DEFAULT 'unverified' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "refund_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"reservation_id" uuid NOT NULL,
	"allocation" "payment_allocation" NOT NULL,
	"amount_cents" integer NOT NULL,
	"method" "payment_method" NOT NULL,
	"reason" text NOT NULL,
	"refunded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"recorded_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refund_entries_amount_positive" CHECK ("refund_entries"."amount_cents" > 0)
);
--> statement-breakpoint
ALTER TABLE "deposit_deductions" ADD CONSTRAINT "deposit_deductions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deposit_deductions" ADD CONSTRAINT "deposit_deductions_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deposit_deductions" ADD CONSTRAINT "deposit_deductions_organization_id_reservation_id_reservations_organization_id_id_fk" FOREIGN KEY ("organization_id","reservation_id") REFERENCES "public"."reservations"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_organization_id_property_id_properties_organization_id_id_fk" FOREIGN KEY ("organization_id","property_id") REFERENCES "public"."properties"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_organization_id_unit_id_units_organization_id_id_fk" FOREIGN KEY ("organization_id","unit_id") REFERENCES "public"."units"("organization_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_entries" ADD CONSTRAINT "payment_entries_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_entries" ADD CONSTRAINT "payment_entries_recorded_by_user_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_entries" ADD CONSTRAINT "payment_entries_organization_id_reservation_id_reservations_organization_id_id_fk" FOREIGN KEY ("organization_id","reservation_id") REFERENCES "public"."reservations"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_proofs" ADD CONSTRAINT "payment_proofs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_proofs" ADD CONSTRAINT "payment_proofs_organization_id_reservation_id_reservations_organization_id_id_fk" FOREIGN KEY ("organization_id","reservation_id") REFERENCES "public"."reservations"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_entries" ADD CONSTRAINT "refund_entries_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_entries" ADD CONSTRAINT "refund_entries_recorded_by_user_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_entries" ADD CONSTRAINT "refund_entries_organization_id_reservation_id_reservations_organization_id_id_fk" FOREIGN KEY ("organization_id","reservation_id") REFERENCES "public"."reservations"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "deposit_deductions_organization_id_unique" ON "deposit_deductions" USING btree ("organization_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "expenses_organization_id_unique" ON "expenses" USING btree ("organization_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_entries_organization_id_unique" ON "payment_entries" USING btree ("organization_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_entries_idempotency_unique" ON "payment_entries" USING btree ("organization_id","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_proofs_organization_id_unique" ON "payment_proofs" USING btree ("organization_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "refund_entries_organization_id_unique" ON "refund_entries" USING btree ("organization_id","id");