import "server-only";

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditEvents, memberships, organizations } from "@/lib/db/schema";

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
