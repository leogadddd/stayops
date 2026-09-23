import "dotenv/config";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { memberships, organizations } from "@/lib/db/schema";
import { createOrganization } from "@/server/orgs/service";
import { eq } from "drizzle-orm";

/**
 * Seed clearly-fake demo data. Idempotent: safe to run repeatedly.
 *
 *   email:    owner@stayops.dev
 *   password: stayops-demo-1234
 */

const SEED_USER = {
  name: "Juan Dela Cruz",
  email: "owner@stayops.dev",
  password: "stayops-demo-1234",
};

const SEED_ORG_NAME = "Demo Stay Operations";

async function main() {
  const signUp = await auth.api.signUpEmail({
    body: {
      name: SEED_USER.name,
      email: SEED_USER.email,
      password: SEED_USER.password,
    },
  });

  const userId = signUp.user?.id;
  if (!userId) {
    throw new Error("Seed sign-up failed and did not return a user.");
  }
  console.log(`seed: user ready (${SEED_USER.email})`);

  const existing = await db
    .select({ organizationId: memberships.organizationId })
    .from(memberships)
    .where(eq(memberships.userId, userId))
    .limit(1);

  if (existing.length > 0) {
    console.log("seed: organization already exists, nothing to do");
    return;
  }

  await createOrganization({
    name: SEED_ORG_NAME,
    ownerUserId: userId,
  });
  console.log(`seed: organization ready (${SEED_ORG_NAME})`);

  const orgs = await db.select().from(organizations).limit(1);
  console.log("\nDemo credentials");
  console.log("  email:   ", SEED_USER.email);
  console.log("  password:", SEED_USER.password);
  console.log("  org:     ", orgs[0]?.name ?? SEED_ORG_NAME);
}

main()
  .catch((error) => {
    console.error("seed failed:", error);
    process.exitCode = 1;
  })
  .finally(() => {
    // postgres.js keeps the connection pool open; let the process exit.
    setTimeout(() => process.exit(process.exitCode ?? 0), 250);
  });
