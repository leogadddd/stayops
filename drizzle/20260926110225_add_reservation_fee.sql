CREATE TYPE "public"."reservation_fee_type" AS ENUM('fixed', 'percent');--> statement-breakpoint
ALTER TABLE "units" ADD COLUMN "reservation_fee_type" "reservation_fee_type";--> statement-breakpoint
ALTER TABLE "units" ADD COLUMN "reservation_fee_amount" integer;--> statement-breakpoint
ALTER TABLE "booking_platforms" ADD COLUMN "collects_payment" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN "reservation_fee_type" "reservation_fee_type";--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN "reservation_fee_amount" integer;--> statement-breakpoint
ALTER TABLE "units" ADD CONSTRAINT "units_reservation_fee_check" CHECK (("units"."reservation_fee_type" IS NULL AND "units"."reservation_fee_amount" IS NULL)
        OR ("units"."reservation_fee_type" = 'fixed' AND "units"."reservation_fee_amount" > 0)
        OR ("units"."reservation_fee_type" = 'percent' AND "units"."reservation_fee_amount" BETWEEN 1 AND 10000));--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_reservation_fee_check" CHECK (("reservations"."reservation_fee_type" IS NULL) = ("reservations"."reservation_fee_amount" IS NULL));--> statement-breakpoint
-- Online travel agencies take the guest's payment themselves; the unit's
-- reservation fee only applies to the team's own channels.
UPDATE "booking_platforms" SET "collects_payment" = true WHERE "key" IN ('airbnb', 'booking_com', 'agoda', 'expedia');
