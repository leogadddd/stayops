import "dotenv/config";

import { db } from "@/lib/db";
import { organizations } from "@/lib/db/schema";
import { seedDefaultAmenities } from "@/server/inventory/amenities";

/**
 * Adds the default property and unit amenities to every organization that
 * is missing them. New organizations get them on creation; run this once
 * for organizations created before amenities existed. Idempotent.
 */
async function main() {
  const orgs = await db.select({ id: organizations.id, name: organizations.name }).from(organizations);
  for (const org of orgs) {
    const added = await seedDefaultAmenities(db, org.id);
    console.log(`${org.name}: ${added} amenit${added === 1 ? "y" : "ies"} added`);
  }
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
