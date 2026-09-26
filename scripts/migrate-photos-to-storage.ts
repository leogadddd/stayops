import "dotenv/config";

import { and, eq, like } from "drizzle-orm";
import { db } from "@/lib/db";
import { properties, units } from "@/lib/db/schema";
import { imageUploadFromDataUrl } from "@/server/inventory/image-upload";
import { storeInventoryPhoto } from "@/server/inventory/photos";

/**
 * Moves property and unit cover photos that were saved inline (as data URLs)
 * into object storage, replacing each with its storage key. New uploads
 * already go to storage; run this once for older photos. Idempotent: rows
 * that already hold a key are skipped.
 *
 *   npm run storage:migrate-photos            # move them
 *   npm run storage:migrate-photos -- --dry-run
 */
const dryRun = process.argv.includes("--dry-run");

async function migrate(
  label: string,
  table: typeof properties | typeof units,
) {
  const rows = await db
    .select({ id: table.id, organizationId: table.organizationId, name: table.name, imageUrl: table.imageUrl })
    .from(table)
    .where(like(table.imageUrl, "data:%"));
  let moved = 0;
  for (const row of rows) {
    // Decoded and re-encoded the same way as new uploads.
    let upload;
    try {
      upload = await imageUploadFromDataUrl(row.imageUrl ?? "");
    } catch (error) {
      console.warn(`  skipped ${label} "${row.name}": ${error instanceof Error ? error.message : error}`);
      continue;
    }
    if (!upload) continue;
    if (dryRun) {
      console.log(`  would move ${label} "${row.name}"`);
      continue;
    }
    const key = await storeInventoryPhoto(row.organizationId, upload);
    // Only replace the value we read, so a photo changed meanwhile is kept.
    await db
      .update(table)
      .set({ imageUrl: key })
      .where(and(eq(table.id, row.id), eq(table.imageUrl, row.imageUrl!)));
    moved++;
    console.log(`  moved ${label} "${row.name}"`);
  }
  return { found: rows.length, moved };
}

async function main() {
  const host = new URL(process.env.DATABASE_URL ?? "postgres://unknown").host;
  console.log(`${dryRun ? "Checking" : "Moving"} inline photos on ${host}`);
  const propertyResult = await migrate("property", properties);
  const unitResult = await migrate("unit", units);
  console.log(
    dryRun
      ? `${propertyResult.found + unitResult.found} photo(s) would be moved.`
      : `Moved ${propertyResult.moved} property and ${unitResult.moved} unit photo(s).`,
  );
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
