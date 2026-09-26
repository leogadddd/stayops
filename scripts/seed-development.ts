import "dotenv/config";

import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { memberships, organizations, roles, user } from "@/lib/db/schema";
import type { RoleKey } from "@/lib/permissions";
import { createOrganization } from "@/server/orgs/service";

/**
 * A local development workspace with one account for every application role.
 * Safe to rerun: it reuses accounts and restores their memberships and roles.
 *
 *   npm run seed:development
 */
const DEVELOPMENT_ORGANIZATION = {
  name: "StayOps Development",
  slug: "stayops-development",
};

const DEVELOPMENT_PASSWORD = "stayops102499";

const DEVELOPMENT_USERS: Array<{
  name: string;
  email: string;
  role: RoleKey;
}> = [
  { name: "Dev Owner", email: "dev-owner@stayops.dev", role: "owner" },
  { name: "Dev Admin", email: "admin@stayops.dev", role: "admin" },
  {
    name: "Dev Operations Manager",
    email: "operations-manager@stayops.dev",
    role: "operations_manager",
  },
  { name: "Dev Staff", email: "staff@stayops.dev", role: "staff" },
];

async function ensureUserId(account: (typeof DEVELOPMENT_USERS)[number]) {
  const existing = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, account.email))
    .limit(1);
  if (existing[0]) return existing[0].id;

  const signUp = await auth.api.signUpEmail({
    body: {
      name: account.name,
      email: account.email,
      password: DEVELOPMENT_PASSWORD,
    },
  });
  if (!signUp.user?.id) {
    throw new Error(`Could not create ${account.email}.`);
  }
  return signUp.user.id;
}

async function ensureDevelopmentWorkspace(ownerUserId: string) {
  const existing = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.slug, DEVELOPMENT_ORGANIZATION.slug))
    .limit(1);
  if (existing[0]) return existing[0].id;

  const organization = await createOrganization({
    ...DEVELOPMENT_ORGANIZATION,
    ownerUserId,
  });
  return organization.id;
}

async function seedDevelopmentWorkspace() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("The development seed cannot run in production.");
  }

  const usersByRole = new Map<RoleKey, string>();
  for (const account of DEVELOPMENT_USERS) {
    usersByRole.set(account.role, await ensureUserId(account));
  }

  const ownerUserId = usersByRole.get("owner");
  if (!ownerUserId) throw new Error("Development owner is missing.");
  const organizationId = await ensureDevelopmentWorkspace(ownerUserId);

  const roleRows = await db.select({ id: roles.id, key: roles.key }).from(roles);
  const roleIds = new Map(roleRows.map((role) => [role.key, role.id]));

  for (const account of DEVELOPMENT_USERS) {
    const userId = usersByRole.get(account.role)!;
    const roleId = roleIds.get(account.role);
    if (!roleId) {
      throw new Error(`The ${account.role} role is unavailable. Run npm run db:migrate first.`);
    }

    await db
      .insert(memberships)
      .values({
        organizationId,
        userId,
        roleId,
        // The legacy column distinguishes only owners from all other roles.
        role: account.role === "owner" ? "owner" : "staff",
      })
      .onConflictDoUpdate({
        target: [memberships.organizationId, memberships.userId],
        set: {
          roleId,
          role: account.role === "owner" ? "owner" : "staff",
          updatedAt: new Date(),
        },
      });
  }

  console.log(`Development workspace ready: ${DEVELOPMENT_ORGANIZATION.name}`);
  console.log(`Password for every development account: ${DEVELOPMENT_PASSWORD}`);
  for (const account of DEVELOPMENT_USERS) {
    console.log(`  ${account.role.padEnd(18)} ${account.email}`);
  }
}

void seedDevelopmentWorkspace()
  .catch((error) => {
    console.error(
      "development seed failed:",
      error instanceof Error ? error.message : error,
    );
    process.exitCode = 1;
  })
  .finally(() => {
    // The shared postgres.js pool keeps the process alive after seeding.
    setTimeout(() => process.exit(process.exitCode ?? 0), 250);
  });
