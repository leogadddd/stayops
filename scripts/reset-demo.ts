import "dotenv/config";

import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditEvents, memberships, organizations, user } from "@/lib/db/schema";
import { SEED_ORG_NAME, SEED_USER, seedDemoData } from "./seed";

/**
 * Removes only the shared seeded demo workspace, then restores its baseline
 * data. Organization-level foreign keys cascade the related demo records;
 * audit events are deleted explicitly because they intentionally have no
 * organization foreign key.
 */
export async function resetDemoData() {
  const demoOrganizations = await db
    .select({ id: organizations.id })
    .from(organizations)
    .innerJoin(
      memberships,
      eq(memberships.organizationId, organizations.id),
    )
    .innerJoin(user, eq(memberships.userId, user.id))
    .where(
      and(
        eq(user.email, SEED_USER.email),
        eq(organizations.name, SEED_ORG_NAME),
      ),
    );

  for (const organization of demoOrganizations) {
    await db.transaction(async (tx) => {
      await tx
        .delete(auditEvents)
        .where(eq(auditEvents.organizationId, organization.id));
      await tx.delete(organizations).where(eq(organizations.id, organization.id));
    });
  }

  await db.delete(user).where(eq(user.email, SEED_USER.email));

  console.log("demo reset: previous shared workspace removed");
  await seedDemoData();
}

if (process.argv[1]?.endsWith("reset-demo.ts")) {
  resetDemoData()
    .catch((error) => {
      console.error("demo reset failed:", error);
      process.exitCode = 1;
    })
    .finally(() => {
      // postgres.js keeps the connection pool open; let the process exit.
      setTimeout(() => process.exit(process.exitCode ?? 0), 250);
    });
}
