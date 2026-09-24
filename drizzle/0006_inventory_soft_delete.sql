ALTER TABLE "properties" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "units" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "properties_org_active_idx" ON "properties" USING btree ("organization_id","deleted_at");--> statement-breakpoint
CREATE INDEX "units_org_active_idx" ON "units" USING btree ("organization_id","deleted_at");--> statement-breakpoint
CREATE INDEX "units_property_active_idx" ON "units" USING btree ("property_id","deleted_at");