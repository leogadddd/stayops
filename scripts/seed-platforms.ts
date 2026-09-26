import "dotenv/config";

import { db } from "@/lib/db";
import { organizations } from "@/lib/db/schema";
import { seedDefaultPlatforms } from "@/server/reservations/platforms";

/**
 * Adds the default booking platforms (Direct, Airbnb, Booking.com, …) to
 * every organization that is missing them. New organizations get them on
 * creation; run this once for organizations created before platforms
 * existed. Idempotent.
 */
async function main() {
  const orgs = await db.select({ id: organizations.id, name: organizations.name }).from(organizations);
  for (const org of orgs) {
    const added = await seedDefaultPlatforms(db, org.id);
    console.log(`${org.name}: ${added} platform${added === 1 ? "" : "s"} added`);
  }
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
