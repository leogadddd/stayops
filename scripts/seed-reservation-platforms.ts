import "dotenv/config";

import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { bookingPlatforms, organizations, reservations } from "@/lib/db/schema";
import { seedDefaultPlatforms } from "@/server/reservations/platforms";
import { assertSafeDatabase, assignSamplePlatforms, samplePlatformReference, SAMPLE_PLATFORM_WEIGHTS } from "./lib/sample-data";

/**
 * Gives every reservation a sample booking platform, mostly Direct (see
 * SAMPLE_PLATFORM_WEIGHTS, split in those proportions per organization),
 * with made-up confirmation codes for the online platforms, so platform
 * filters and reports have data to show. Picks come from the reservation
 * ids, so reruns give the same result.
 *
 *   npm run seed:reservation-platforms              # every organization
 *   npm run seed:reservation-platforms -- "Casa"    # organizations whose name contains "Casa"
 *   npm run seed:reservation-platforms -- --dry-run # show the counts only
 *
 * Overwrites platforms already set. Only a local database is allowed unless
 * --allow-remote is passed.
 */
async function main() {
  assertSafeDatabase();
  const dryRun = process.argv.includes("--dry-run");
  const nameFilter = process.argv.slice(2).find((arg) => !arg.startsWith("--"))?.toLowerCase();

  const orgs = (await db.select({ id: organizations.id, name: organizations.name }).from(organizations))
    .filter((org) => !nameFilter || org.name.toLowerCase().includes(nameFilter));
  if (!orgs.length) throw new Error(`No organization matches "${nameFilter}".`);

  for (const org of orgs) {
    // Organizations made before platforms existed may not have them yet.
    if (!dryRun) await seedDefaultPlatforms(db, org.id);
    const platforms = await db
      .select({ id: bookingPlatforms.id, key: bookingPlatforms.key, name: bookingPlatforms.name })
      .from(bookingPlatforms)
      .where(eq(bookingPlatforms.organizationId, org.id));
    const byKey = new Map(platforms.filter((platform) => platform.key).map((platform) => [platform.key!, platform]));
    const rows = await db.select({ id: reservations.id }).from(reservations).where(eq(reservations.organizationId, org.id));

    const picks = assignSamplePlatforms(rows.map((row) => row.id));
    const counts = new Map<string, number>();
    for (const row of rows) {
      // Fall back to Direct when the team removed the picked platform's key.
      const picked = picks.get(row.id)!;
      const key = byKey.has(picked) ? picked : "direct";
      const platform = byKey.get(key);
      if (!platform) continue;
      counts.set(platform.name, (counts.get(platform.name) ?? 0) + 1);
      if (dryRun) continue;
      await db
        .update(reservations)
        .set({ platformId: platform.id, platformReference: samplePlatformReference(key, row.id) })
        .where(and(eq(reservations.id, row.id), eq(reservations.organizationId, org.id)));
    }
    const order = SAMPLE_PLATFORM_WEIGHTS.map(([key]) => byKey.get(key)?.name).filter(Boolean) as string[];
    const summary = order.filter((name) => counts.get(name)).map((name) => `${name} ${counts.get(name)}`).join(", ");
    console.log(`${org.name}: ${rows.length} reservation${rows.length === 1 ? "" : "s"}${dryRun ? " would get" : " →"} ${summary || "none"}`);
  }
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
