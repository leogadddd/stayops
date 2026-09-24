import "server-only";

import { and, eq, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditEvents, memberships, organizations, user } from "@/lib/db/schema";

export const ORG_NAME_MAX = 80;
export const ORG_SLUG_MAX = 60;

export class OrgError extends Error {
  constructor(
    message: string,
    readonly field?: string,
  ) {
    super(message);
    this.name = "OrgError";
  }
}

/** Lowercase, URL-safe organization slug from a name. */
export function slugify(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, ORG_SLUG_MAX);
  return slug;
}

export function validateOrgName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length < 2) {
    throw new OrgError("Organization name needs at least 2 characters.", "name");
  }
  if (trimmed.length > ORG_NAME_MAX) {
    throw new OrgError(
      `Organization name must be ${ORG_NAME_MAX} characters or fewer.`,
      "name",
    );
  }
  return trimmed;
}

export async function createOrganization(input: {
  name: string;
  slug?: string;
  ownerUserId: string;
}): Promise<{ id: string; name: string; slug: string }> {
  const name = validateOrgName(input.name);
  const baseSlug = slugify(input.slug ?? name);
  if (baseSlug.length < 2) {
    throw new OrgError(
      "Use a name with at least 2 letters or numbers.",
      "name",
    );
  }

  return db.transaction(async (tx) => {
    // Resolve slug collisions deterministically inside the transaction.
    let slug = baseSlug;
    for (let attempt = 0; attempt < 20; attempt++) {
      const existing = await tx
        .select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.slug, slug))
        .limit(1);
      if (existing.length === 0) break;
      const suffix = `-${Math.random().toString(36).slice(2, 6)}`;
      slug = `${baseSlug.slice(0, ORG_SLUG_MAX - suffix.length)}${suffix}`;
      if (attempt === 19) {
        throw new OrgError(
          "Could not allocate a unique slug. Try a different name.",
          "name",
        );
      }
    }

    const [org] = await tx
      .insert(organizations)
      .values({ name, slug })
      .returning({ id: organizations.id, name: organizations.name, slug: organizations.slug });

    if (!org) {
      throw new OrgError("Failed to create the organization.");
    }

    await tx.insert(memberships).values({
      organizationId: org.id,
      userId: input.ownerUserId,
      role: "owner",
    });

    await tx.insert(auditEvents).values({
      organizationId: org.id,
      actorUserId: input.ownerUserId,
      entity: "organization",
      entityId: org.id,
      action: "organization.created",
      metadata: { name: org.name },
    });

    return org;
  });
}

export async function updatePaymentInstructions(input: {
  organizationId: string;
  instructions: string;
  actorUserId: string;
}): Promise<void> {
  const instructions = input.instructions.trim();
  if (instructions.length > 2000) {
    throw new OrgError(
      "Payment instructions must be 2000 characters or fewer.",
      "paymentInstructions",
    );
  }
  await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(organizations)
      .set({ paymentInstructions: instructions || null, updatedAt: new Date() })
      .where(eq(organizations.id, input.organizationId))
      .returning({ id: organizations.id });
    if (!updated) {
      throw new OrgError("Organization not found.");
    }
    await tx.insert(auditEvents).values({
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      entity: "organization",
      entityId: input.organizationId,
      action: "organization.payment_instructions_updated",
    });
  });
}

export async function updateOrganizationName(input: {
  organizationId: string;
  name: string;
  actorUserId: string;
}): Promise<void> {
  const name = validateOrgName(input.name);
  await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(organizations)
      .set({ name, updatedAt: new Date() })
      .where(eq(organizations.id, input.organizationId))
      .returning({ id: organizations.id });
    if (!updated) {
      throw new OrgError("Organization not found.");
    }
    await tx.insert(auditEvents).values({
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      entity: "organization",
      entityId: input.organizationId,
      action: "organization.renamed",
      metadata: { name },
    });
  });
}

export interface StaffMember {
  membershipId: string;
  role: "owner" | "staff";
  name: string;
  email: string;
}

export async function inviteStaff(input: {
  organizationId: string;
  actorUserId: string;
  email: string;
}): Promise<StaffMember> {
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new OrgError("Enter a valid email address.", "email");
  }

  return db.transaction(async (tx) => {
    const [account] = await tx
      .select({ id: user.id, name: user.name, email: user.email })
      .from(user)
      .where(eq(user.email, email))
      .limit(1);
    if (!account) {
      throw new OrgError(
        "No StayOps account exists for that email. The person must sign up first, then you can add them.",
        "email",
      );
    }

    const existing = await tx
      .select({ id: memberships.id })
      .from(memberships)
      .where(
        and(
          eq(memberships.organizationId, input.organizationId),
          eq(memberships.userId, account.id),
        ),
      )
      .limit(1);
    if (existing.length > 0) {
      throw new OrgError("That person is already a member of this organization.", "email");
    }

    const [member] = await tx
      .insert(memberships)
      .values({ organizationId: input.organizationId, userId: account.id, role: "staff" })
      .returning({ id: memberships.id });
    if (!member) {
      throw new OrgError("Failed to add the member. Try again.");
    }

    await tx.insert(auditEvents).values({
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      entity: "membership",
      entityId: member.id,
      action: "organization.staff_invited",
      metadata: { email: account.email, name: account.name },
    });

    return {
      membershipId: member.id,
      role: "staff",
      name: account.name,
      email: account.email,
    };
  });
}

export async function removeStaff(input: {
  organizationId: string;
  actorUserId: string;
  membershipId: string;
}): Promise<void> {
  await db.transaction(async (tx) => {
    const [target] = await tx
      .select({
        id: memberships.id,
        role: memberships.role,
        userId: memberships.userId,
        name: user.name,
        email: user.email,
      })
      .from(memberships)
      .innerJoin(user, eq(memberships.userId, user.id))
      .where(
        and(
          eq(memberships.id, input.membershipId),
          eq(memberships.organizationId, input.organizationId),
        ),
      )
      .limit(1);
    if (!target) {
      throw new OrgError("Member not found.");
    }
    if (target.role !== "staff") {
      throw new OrgError("Owners cannot be removed.");
    }
    if (target.userId === input.actorUserId) {
      throw new OrgError("You cannot remove yourself.");
    }

    await tx
      .delete(memberships)
      .where(
        and(
          eq(memberships.id, input.membershipId),
          eq(memberships.organizationId, input.organizationId),
          ne(memberships.role, "owner"),
        ),
      );

    await tx.insert(auditEvents).values({
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      entity: "membership",
      entityId: input.membershipId,
      action: "organization.staff_removed",
      metadata: { name: target.name, email: target.email },
    });
  });
}
