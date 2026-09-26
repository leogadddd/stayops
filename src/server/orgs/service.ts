import "server-only";

import { and, asc, eq, ilike, inArray, isNull, ne, or } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { auditEvents, memberships, organizationInvitations, organizationJoinCodes, organizationJoinRequests, organizations, roles, user } from "@/lib/db/schema";
import { type RoleKey } from "@/lib/permissions";
import { seedDefaultAmenities } from "@/server/inventory/amenities";
import { seedDefaultPlatforms } from "@/server/reservations/platforms";
import { isSupportedTimeZone } from "@/lib/timezones";
import { isValidPhilippineAddress } from "@/lib/philippine-locations";

export const ORG_NAME_MAX = 80;
export const ORG_SLUG_MAX = 60;
export const INVITATION_VALID_DAYS = 14;

export class OrgError extends Error {
  constructor(
    message: string,
    readonly field?: string,
  ) {
    super(message);
    this.name = "OrgError";
  }
}

function normalizeEmail(value: string): string {
  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new OrgError("Enter a valid email address.", "email");
  }
  return email;
}

function newAccessCode(): string {
  return randomBytes(18).toString("base64url");
}

function digestAccessCode(code: string): string {
  return createHash("sha256").update(code.trim()).digest("hex");
}

async function getRole(tx: Pick<typeof db, "select">, key: RoleKey) {
  const [role] = await tx.select({ id: roles.id, key: roles.key }).from(roles).where(eq(roles.key, key)).limit(1);
  if (!role) throw new OrgError("Role configuration is missing. Run database migrations and seeds.");
  return role;
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

function optionalText(value: string, max: number, field: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length > max) {
    throw new OrgError(`${field} must be ${max} characters or fewer.`);
  }
  return trimmed || null;
}

function validateTimeZone(value: string): string {
  const timezone = value.trim();
  if (!isSupportedTimeZone(timezone)) {
    throw new OrgError("Choose a timezone from the supported list.", "defaultTimezone");
  }
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
  } catch {
    throw new OrgError("Use a valid IANA timezone like Asia/Manila.", "defaultTimezone");
  }
  return timezone;
}

export interface OrganizationProfileInput {
  name: string;
  displayName: string;
  logoUrl?: string | null;
  contactEmail: string;
  contactPhone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  municipality: string;
  province: string;
  region: string;
  country: string;
  legalName: string;
  taxId: string;
}

export interface OrganizationSearchResult {
  id: string;
  name: string;
}

/**
 * Organizations whose name contains `query`, for the L1 organization
 * picker. Callers check L1 access; an empty query finds nothing.
 */
export async function searchOrganizations(query: string, limit = 20): Promise<OrganizationSearchResult[]> {
  const search = query.trim().slice(0, 80);
  if (!search) return [];
  const pattern = `%${search.replace(/[\\%_]/g, (match) => `\\${match}`)}%`;
  return db
    .select({ id: organizations.id, name: organizations.name })
    .from(organizations)
    .where(ilike(organizations.name, pattern))
    .orderBy(asc(organizations.name))
    .limit(limit);
}

/** The organizations that still exist among `ids`, with their current names. */
export async function findOrganizationsByIds(ids: string[]): Promise<OrganizationSearchResult[]> {
  if (!ids.length) return [];
  return db
    .select({ id: organizations.id, name: organizations.name })
    .from(organizations)
    .where(inArray(organizations.id, ids));
}

/** The stored object key (or legacy data URL) currently used for the logo. */
export async function getOrganizationLogoUrl(organizationId: string): Promise<string | null> {
  const organization = await db.query.organizations.findFirst({
    columns: { logoUrl: true },
    where: eq(organizations.id, organizationId),
  });
  if (!organization) throw new OrgError("Organization not found.");
  return organization.logoUrl;
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
    await seedDefaultAmenities(tx, org.id);
    await seedDefaultPlatforms(tx, org.id);

    const ownerRole = await getRole(tx, "owner");
    await tx.insert(memberships).values({
      organizationId: org.id,
      userId: input.ownerUserId,
      roleId: ownerRole.id,
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

export async function updateOrganizationProfile(input: {
  organizationId: string;
  actorUserId: string;
  data: OrganizationProfileInput;
}): Promise<void> {
  const name = validateOrgName(input.data.name);
  const displayName = optionalText(input.data.displayName, 80, "Display name");
  const contactEmail = optionalText(input.data.contactEmail, 254, "Contact email");
  if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    throw new OrgError("Enter a valid contact email.", "contactEmail");
  }
  const contactPhone = optionalText(input.data.contactPhone, 40, "Contact phone");
  const addressLine1 = optionalText(input.data.addressLine1, 160, "Address line 1");
  const addressLine2 = optionalText(input.data.addressLine2, 160, "Address line 2");
  const region = optionalText(input.data.region, 120, "Region");
  const province = optionalText(input.data.province, 120, "Province");
  const city = optionalText(input.data.city, 120, "City");
  const municipality = optionalText(input.data.municipality, 120, "Municipality");
  if (input.data.country !== "Philippines") throw new OrgError("Country is currently fixed to the Philippines.", "country");
  if (!isValidPhilippineAddress({ region: region ?? "", province: province ?? "", city: city ?? "", municipality: municipality ?? "" })) throw new OrgError("Choose a valid Philippine region, province, and either a city or municipality.", "city");
  const legalName = optionalText(input.data.legalName, 120, "Legal business name");
  const taxId = optionalText(input.data.taxId, 80, "Tax ID");

  await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(organizations)
      .set({
        name,
        displayName,
        ...(input.data.logoUrl !== undefined ? { logoUrl: input.data.logoUrl } : {}),
        contactEmail,
        contactPhone,
        addressLine1,
        addressLine2,
        city,
        municipality,
        province,
        region,
        country: "Philippines",
        legalName,
        taxId,
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, input.organizationId))
      .returning({ id: organizations.id });
    if (!updated) throw new OrgError("Organization not found.");
    await tx.insert(auditEvents).values({
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      entity: "organization",
      entityId: input.organizationId,
      action: "organization.profile_updated",
      metadata: { name, displayName },
    });
  });
}

export async function updateOrganizationRegion(input: {
  organizationId: string;
  actorUserId: string;
  defaultTimezone: string;
}): Promise<void> {
  const defaultTimezone = validateTimeZone(input.defaultTimezone);
  await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(organizations)
      .set({ defaultTimezone, updatedAt: new Date() })
      .where(eq(organizations.id, input.organizationId))
      .returning({ id: organizations.id });
    if (!updated) throw new OrgError("Organization not found.");
    await tx.insert(auditEvents).values({
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      entity: "organization",
      entityId: input.organizationId,
      action: "organization.region_updated",
      metadata: { defaultTimezone },
    });
  });
}

export interface StaffMember {
  membershipId: string;
  role: RoleKey;
  name: string;
  email: string;
}

export interface CreatedInvitation {
  invitationId: string;
  code: string;
  email: string;
  role: RoleKey;
  expiresAt: Date;
}

/**
 * Create an email-bound invitation. Delivery is intentionally left to the
 * caller so deployments can use their own transactional email provider.
 * The raw code is returned exactly once; only a SHA-256 digest is stored.
 */
export async function inviteStaff(input: {
  organizationId: string;
  actorUserId: string;
  email: string;
  role?: RoleKey;
}): Promise<CreatedInvitation> {
  const email = normalizeEmail(input.email);
  const roleKey = input.role ?? "staff";
  if (roleKey === "owner") throw new OrgError("Ownership cannot be granted by invitation.");
  const code = newAccessCode();
  const expiresAt = new Date(Date.now() + INVITATION_VALID_DAYS * 86_400_000);

  return db.transaction(async (tx) => {
    const role = await getRole(tx, roleKey);
    const [account] = await tx.select({ id: user.id }).from(user).where(eq(user.email, email)).limit(1);
    if (account) {
      const existing = await tx.select({ id: memberships.id }).from(memberships).where(and(eq(memberships.organizationId, input.organizationId), eq(memberships.userId, account.id))).limit(1);
      if (existing.length) throw new OrgError("That person is already a member of this organization.", "email");
    }
    await tx.update(organizationInvitations).set({ status: "revoked", revokedAt: new Date(), updatedAt: new Date() }).where(and(eq(organizationInvitations.organizationId, input.organizationId), eq(organizationInvitations.email, email), eq(organizationInvitations.status, "pending")));
    const [invitation] = await tx.insert(organizationInvitations).values({
      organizationId: input.organizationId, email, roleId: role.id, codeHash: digestAccessCode(code),
      expiresAt, invitedByUserId: input.actorUserId,
    }).returning({ id: organizationInvitations.id });
    if (!invitation) throw new OrgError("Failed to create invitation. Try again.");

    await tx.insert(auditEvents).values({
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      entity: "organization_invitation",
      entityId: invitation.id,
      action: "organization.staff_invited",
      metadata: { email, role: roleKey, expiresAt: expiresAt.toISOString() },
    });

    return { invitationId: invitation.id, code, email, role: roleKey, expiresAt };
  });
}

/** Inspect a code after sign-in; never exposes the invitee email. */
export async function getInvitationForUser(input: { code: string; email: string }) {
  const email = normalizeEmail(input.email);
  const [invitation] = await db.select({
    id: organizationInvitations.id, expiresAt: organizationInvitations.expiresAt,
    organization: { id: organizations.id, name: organizations.name },
    role: { key: roles.key, name: roles.name },
  }).from(organizationInvitations)
    .innerJoin(organizations, eq(organizationInvitations.organizationId, organizations.id))
    .innerJoin(roles, eq(organizationInvitations.roleId, roles.id))
    .where(and(eq(organizationInvitations.codeHash, digestAccessCode(input.code)), eq(organizationInvitations.email, email), eq(organizationInvitations.status, "pending")))
    .limit(1);
  if (!invitation || invitation.expiresAt <= new Date()) throw new OrgError("This invitation is invalid or has expired.", "code");
  return { invitationId: invitation.id, organization: invitation.organization, role: invitation.role, expiresAt: invitation.expiresAt };
}

export async function acceptInvitation(input: { code: string; userId: string; email: string }): Promise<{ organizationId: string }> {
  const email = normalizeEmail(input.email);
  return db.transaction(async (tx) => {
    const [invitation] = await tx.select({ id: organizationInvitations.id, organizationId: organizationInvitations.organizationId, roleId: organizationInvitations.roleId, expiresAt: organizationInvitations.expiresAt })
      .from(organizationInvitations).where(and(eq(organizationInvitations.codeHash, digestAccessCode(input.code)), eq(organizationInvitations.email, email), eq(organizationInvitations.status, "pending"))).limit(1);
    if (!invitation || invitation.expiresAt <= new Date()) throw new OrgError("This invitation is invalid or has expired.", "code");
    const existing = await tx.select({ id: memberships.id }).from(memberships).where(and(eq(memberships.organizationId, invitation.organizationId), eq(memberships.userId, input.userId))).limit(1);
    if (!existing.length) {
      const [role] = await tx.select({ key: roles.key }).from(roles).where(eq(roles.id, invitation.roleId)).limit(1);
      if (!role) throw new OrgError("Invitation role is unavailable.");
      await tx.insert(memberships).values({ organizationId: invitation.organizationId, userId: input.userId, roleId: invitation.roleId, role: role.key === "owner" ? "owner" : "staff" });
    }
    await tx.update(organizationInvitations).set({ status: "accepted", acceptedByUserId: input.userId, acceptedAt: new Date(), updatedAt: new Date() }).where(eq(organizationInvitations.id, invitation.id));
    return { organizationId: invitation.organizationId };
  });
}

/** Generate a reusable join code. Joining it always requires owner approval. */
export async function createOrganizationJoinCode(input: { organizationId: string; actorUserId: string; expiresAt?: Date | null }) {
  const code = newAccessCode();
  const [joinCode] = await db.insert(organizationJoinCodes).values({ organizationId: input.organizationId, codeHash: digestAccessCode(code), expiresAt: input.expiresAt ?? null, createdByUserId: input.actorUserId }).returning({ id: organizationJoinCodes.id });
  if (!joinCode) throw new OrgError("Failed to create join code.");
  return { joinCodeId: joinCode.id, code, expiresAt: input.expiresAt ?? null };
}

/** Used by onboarding after a signed-in account enters a shareable org code. */
export async function requestOrganizationAccess(input: { code: string; userId: string }) {
  return db.transaction(async (tx) => {
    const [joinCode] = await tx.select({ organizationId: organizationJoinCodes.organizationId, expiresAt: organizationJoinCodes.expiresAt })
      .from(organizationJoinCodes).where(and(eq(organizationJoinCodes.codeHash, digestAccessCode(input.code)), isNull(organizationJoinCodes.revokedAt))).limit(1);
    if (!joinCode || (joinCode.expiresAt && joinCode.expiresAt <= new Date())) throw new OrgError("This organization code is invalid or has expired.", "code");
    const member = await tx.select({ id: memberships.id }).from(memberships).where(and(eq(memberships.organizationId, joinCode.organizationId), eq(memberships.userId, input.userId))).limit(1);
    if (member.length) throw new OrgError("You are already a member of this organization.");
    const staffRole = await getRole(tx, "staff");
    const [request] = await tx.insert(organizationJoinRequests).values({ organizationId: joinCode.organizationId, userId: input.userId, requestedRoleId: staffRole.id }).onConflictDoUpdate({ target: [organizationJoinRequests.organizationId, organizationJoinRequests.userId], set: { status: "pending", updatedAt: new Date(), reviewedByUserId: null, reviewedAt: null } }).returning({ id: organizationJoinRequests.id });
    return { requestId: request!.id, organizationId: joinCode.organizationId };
  });
}

export async function reviewOrganizationJoinRequest(input: { organizationId: string; actorUserId: string; requestId: string; approve: boolean }): Promise<void> {
  await db.transaction(async (tx) => {
    const [request] = await tx.select().from(organizationJoinRequests).where(and(eq(organizationJoinRequests.id, input.requestId), eq(organizationJoinRequests.organizationId, input.organizationId), eq(organizationJoinRequests.status, "pending"))).limit(1);
    if (!request) throw new OrgError("Join request not found or already reviewed.");
    if (input.approve) {
      const [role] = await tx.select({ key: roles.key }).from(roles).where(eq(roles.id, request.requestedRoleId)).limit(1);
      if (!role) throw new OrgError("Requested role is unavailable.");
      await tx.insert(memberships).values({ organizationId: request.organizationId, userId: request.userId, roleId: request.requestedRoleId, role: role.key === "owner" ? "owner" : "staff" }).onConflictDoNothing();
    }
    await tx.update(organizationJoinRequests).set({ status: input.approve ? "approved" : "rejected", reviewedByUserId: input.actorUserId, reviewedAt: new Date(), updatedAt: new Date() }).where(eq(organizationJoinRequests.id, request.id));
  });
}

export async function listAssignableRoles(): Promise<Array<{ key: Exclude<RoleKey, "owner">; name: string; description: string }>> {
  const rows = await db.select({ key: roles.key, name: roles.name, description: roles.description }).from(roles);
  return rows.filter((role): role is { key: Exclude<RoleKey, "owner">; name: string; description: string } => role.key !== "owner");
}

export async function listOrganizationJoinRequests(organizationId: string) {
  return db.select({
    id: organizationJoinRequests.id, status: organizationJoinRequests.status, createdAt: organizationJoinRequests.createdAt,
    user: { id: user.id, name: user.name, email: user.email },
    requestedRole: { key: roles.key, name: roles.name },
  }).from(organizationJoinRequests)
    .innerJoin(user, eq(organizationJoinRequests.userId, user.id))
    .innerJoin(roles, eq(organizationJoinRequests.requestedRoleId, roles.id))
    .where(and(eq(organizationJoinRequests.organizationId, organizationId), eq(organizationJoinRequests.status, "pending")));
}

/** Promote or demote a non-owner member. Ownership is never granted or taken here. */
export async function changeMemberRole(input: {
  organizationId: string;
  actorUserId: string;
  membershipId: string;
  role: Exclude<RoleKey, "owner">;
}): Promise<void> {
  if ((input.role as RoleKey) === "owner") throw new OrgError("Ownership cannot be granted by changing a role.");
  await db.transaction(async (tx) => {
    const [target] = await tx
      .select({ id: memberships.id, userId: memberships.userId, roleKey: roles.key, name: user.name, email: user.email })
      .from(memberships)
      .innerJoin(roles, eq(memberships.roleId, roles.id))
      .innerJoin(user, eq(memberships.userId, user.id))
      .where(and(eq(memberships.id, input.membershipId), eq(memberships.organizationId, input.organizationId)))
      .limit(1);
    if (!target) throw new OrgError("Member not found.");
    if (target.roleKey === "owner") throw new OrgError("The owner's role can't be changed.");
    if (target.userId === input.actorUserId) throw new OrgError("You cannot change your own role.");
    if (target.roleKey === input.role) return;

    const role = await getRole(tx, input.role);
    await tx
      .update(memberships)
      // The legacy column only distinguishes owners; every other role is "staff".
      .set({ roleId: role.id, role: "staff", updatedAt: new Date() })
      .where(and(eq(memberships.id, target.id), eq(memberships.organizationId, input.organizationId)));

    await tx.insert(auditEvents).values({
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      entity: "membership",
      entityId: target.id,
      action: "organization.member_role_changed",
      metadata: { name: target.name, email: target.email, fromRole: target.roleKey, toRole: input.role },
    });
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
