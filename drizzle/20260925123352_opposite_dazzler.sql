ALTER TABLE "organizations" ADD COLUMN "display_name" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "default_timezone" text DEFAULT 'Asia/Manila' NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "contact_email" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "contact_phone" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "business_address" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "legal_name" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "tax_id" text;