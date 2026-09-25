ALTER TABLE "organizations" ADD COLUMN "logo_url" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "address_line_1" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "address_line_2" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "city" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "region" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "country" text DEFAULT 'Philippines' NOT NULL;
--> statement-breakpoint
UPDATE "organizations"
SET "address_line_1" = "business_address"
WHERE "address_line_1" IS NULL AND "business_address" IS NOT NULL;
