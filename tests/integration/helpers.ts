import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";
import { createOrganization } from "@/server/orgs/service";
import { createProperty, createUnit } from "@/server/inventory/service";

let counter = 0;
function unique(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}`;
}

export interface TestUser {
  id: string;
  name: string;
  email: string;
}

export async function createTestUser(label = "user"): Promise<TestUser> {
  const id = crypto.randomUUID();
  const testUser: TestUser = {
    id,
    name: `Test ${label}`,
    email: `${unique(label)}@example.com`,
  };
  await db.insert(user).values({
    id: testUser.id,
    name: testUser.name,
    email: testUser.email,
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return testUser;
}

export async function createTestOrg(label = "org") {
  const owner = await createTestUser(`${label}-owner`);
  const org = await createOrganization({
    name: `Test ${label} organization`,
    ownerUserId: owner.id,
  });
  return { org, owner };
}

export async function createTestProperty(
  organizationId: string,
  actorUserId: string,
  name = "Test property",
) {
  return createProperty({
    organizationId,
    actorUserId,
    data: {
      name,
      timezone: "Asia/Manila",
      checkInTime: "15:00",
      checkOutTime: "11:00",
    },
  });
}

export async function createActiveUnit(
  organizationId: string,
  actorUserId: string,
  propertyId: string,
  name = "Test unit",
) {
  return createUnit({
    organizationId,
    actorUserId,
    propertyId,
    data: {
      name,
      capacity: 4,
      bedrooms: 2,
      bathrooms: 1,
      defaultNightlyRateCents: 250_000,
      cleaningFeeCents: null,
      securityDepositCents: null,
      checkInTime: "15:00", checkOutTime: "11:00",
      status: "active",
    },
  });
}

/** Two-night stay starting a fixed distance from today, as local dates. */
export function stayDates(startOffsetDays = 30): {
  checkIn: string;
  checkOut: string;
} {
  const base = new Date();
  base.setDate(base.getDate() + startOffsetDays);
  const checkIn = base.toISOString().slice(0, 10);
  const end = new Date(base);
  end.setDate(end.getDate() + 2);
  const checkOut = end.toISOString().slice(0, 10);
  return { checkIn, checkOut };
}
