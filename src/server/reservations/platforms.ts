import "server-only";

import { and, asc, count, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { auditEvents, bookingPlatforms, reservations } from "@/lib/db/schema";
import { DEFAULT_PLATFORMS } from "@/lib/platforms";
import { ReservationError } from "./validation";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Executor = Tx | typeof db;

export interface PlatformOption {
  id: string;
  /** Built-in platform key ("airbnb"); null for custom ones. */
  key: string | null;
  name: string;
  logoUrl: string | null;
  color: string | null;
  /** The platform takes the guest's payment; no reservation fee applies. */
  collectsPayment: boolean;
  isActive: boolean;
}

/** Adds any missing default platforms to an organization. Idempotent. */
export async function seedDefaultPlatforms(executor: Executor, organizationId: string): Promise<number> {
  const rows = DEFAULT_PLATFORMS.map((platform, position) => ({ organizationId, position, ...platform }));
  const inserted = await executor.insert(bookingPlatforms).values(rows).onConflictDoNothing().returning({ id: bookingPlatforms.id });
  return inserted.length;
}

/** The organization's platforms in form order; inactive ones only when asked. */
export async function listPlatforms(organizationId: string, options: { includeInactive?: boolean } = {}): Promise<PlatformOption[]> {
  const conditions = [eq(bookingPlatforms.organizationId, organizationId)];
  if (!options.includeInactive) conditions.push(eq(bookingPlatforms.isActive, true));
  return db
    .select({ id: bookingPlatforms.id, key: bookingPlatforms.key, name: bookingPlatforms.name, logoUrl: bookingPlatforms.logoUrl, color: bookingPlatforms.color, collectsPayment: bookingPlatforms.collectsPayment, isActive: bookingPlatforms.isActive })
    .from(bookingPlatforms)
    .where(and(...conditions))
    .orderBy(asc(bookingPlatforms.position), asc(sql`lower(${bookingPlatforms.name})`));
}

/**
 * Rejects a platform from another organization, and an inactive one unless
 * the reservation already uses it (`currentPlatformId`), so edits of older
 * bookings still save. Returns the platform, or null when none was chosen.
 */
export async function assertPlatform(tx: Executor, organizationId: string, platformId: string | null | undefined, currentPlatformId?: string | null) {
  if (!platformId) return null;
  const [platform] = await tx
    .select({ id: bookingPlatforms.id, isActive: bookingPlatforms.isActive, collectsPayment: bookingPlatforms.collectsPayment })
    .from(bookingPlatforms)
    .where(and(eq(bookingPlatforms.id, platformId), eq(bookingPlatforms.organizationId, organizationId)))
    .limit(1);
  if (!platform || (!platform.isActive && platform.id !== currentPlatformId)) {
    throw new ReservationError("That booking platform is no longer available. Refresh and try again.", "platformId");
  }
  return platform;
}

/** A platform as the settings page manages it. */
export interface ManagedPlatform extends PlatformOption {
  websiteUrl: string | null;
  commissionBasisPoints: number | null;
  /** Reservations made through it; a used platform can only be archived. */
  reservationCount: number;
}

/** Every platform, active first in form order, with how often each was used. */
export async function listManagedPlatforms(organizationId: string): Promise<ManagedPlatform[]> {
  const usage = db
    .select({ platformId: reservations.platformId, total: count().as("total") })
    .from(reservations)
    .where(eq(reservations.organizationId, organizationId))
    .groupBy(reservations.platformId)
    .as("usage");
  const rows = await db
    .select({
      id: bookingPlatforms.id,
      key: bookingPlatforms.key,
      name: bookingPlatforms.name,
      logoUrl: bookingPlatforms.logoUrl,
      color: bookingPlatforms.color,
      websiteUrl: bookingPlatforms.websiteUrl,
      commissionBasisPoints: bookingPlatforms.commissionBasisPoints,
      collectsPayment: bookingPlatforms.collectsPayment,
      isActive: bookingPlatforms.isActive,
      reservationCount: sql<number>`coalesce(${usage.total}, 0)::int`,
    })
    .from(bookingPlatforms)
    .leftJoin(usage, eq(usage.platformId, bookingPlatforms.id))
    .where(eq(bookingPlatforms.organizationId, organizationId))
    .orderBy(sql`${bookingPlatforms.isActive} DESC`, asc(bookingPlatforms.position), asc(sql`lower(${bookingPlatforms.name})`));
  return rows;
}

export class PlatformError extends Error {
  constructor(message: string, readonly field?: string) {
    super(message);
    this.name = "PlatformError";
  }
}

const optionalText = z.string().trim().optional().transform((value) => value || null);

export const platformInputSchema = z.object({
  name: z.string().trim().min(2, "Platform names need at least 2 characters.").max(60, "Platform names must be 60 characters or fewer."),
  color: optionalText.refine((value) => value === null || /^#[0-9a-fA-F]{6}$/.test(value), "Use a hex color like #1877F2."),
  websiteUrl: optionalText.refine((value) => value === null || /^https?:\/\/\S+\.\S+$/.test(value), "Use a full web address, like https://www.airbnb.com."),
  // Basis points: 1500 = 15%.
  commissionBasisPoints: z.number().int().min(0, "Commission can't be negative.").max(10_000, "Commission can't be over 100%.").nullable(),
  collectsPayment: z.boolean(),
});

export type PlatformInput = z.input<typeof platformInputSchema>;

function isUniqueViolation(error: unknown): boolean {
  if (error instanceof Error && error.cause) return isUniqueViolation(error.cause);
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "23505";
}

async function audit(tx: Executor, input: { organizationId: string; actorUserId: string; platformId: string; action: string; metadata: Record<string, unknown> }) {
  await tx.insert(auditEvents).values({
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    entity: "booking_platform",
    entityId: input.platformId,
    action: input.action,
    metadata: input.metadata,
  });
}

async function getPlatformOrThrow(tx: Executor, organizationId: string, platformId: string) {
  const [platform] = await tx
    .select()
    .from(bookingPlatforms)
    .where(and(eq(bookingPlatforms.id, platformId), eq(bookingPlatforms.organizationId, organizationId)))
    .limit(1)
    .for("update");
  if (!platform) throw new PlatformError("That platform no longer exists. Refresh and try again.");
  return platform;
}

/** Adds a custom platform at the end of the reservation form's list. */
export async function createPlatform(input: { organizationId: string; actorUserId: string; data: PlatformInput }) {
  const data = platformInputSchema.parse(input.data);
  try {
    return await db.transaction(async (tx) => {
      const [last] = await tx
        .select({ position: sql<number>`coalesce(max(${bookingPlatforms.position}), -1)::int` })
        .from(bookingPlatforms)
        .where(eq(bookingPlatforms.organizationId, input.organizationId));
      const [platform] = await tx
        .insert(bookingPlatforms)
        .values({ organizationId: input.organizationId, ...data, position: (last?.position ?? -1) + 1 })
        .returning();
      if (!platform) throw new PlatformError("Failed to add the platform.");
      await audit(tx, { ...input, platformId: platform.id, action: "platform.created", metadata: { name: platform.name } });
      return platform;
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new PlatformError(`There's already a platform called ${data.name}.`, "name");
    throw error;
  }
}

export async function updatePlatform(input: { organizationId: string; actorUserId: string; platformId: string; data: PlatformInput }) {
  const data = platformInputSchema.parse(input.data);
  try {
    return await db.transaction(async (tx) => {
      const existing = await getPlatformOrThrow(tx, input.organizationId, input.platformId);
      const fields = (Object.keys(data) as (keyof typeof data)[]).filter((field) => data[field] !== existing[field]);
      const [platform] = await tx
        .update(bookingPlatforms)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(bookingPlatforms.id, existing.id))
        .returning();
      if (fields.length) {
        await audit(tx, { ...input, action: "platform.updated", metadata: { name: data.name, fields } });
      }
      return platform!;
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new PlatformError(`There's already a platform called ${data.name}.`, "name");
    throw error;
  }
}

/**
 * Takes a platform off the reservation form. Built-in platforms and ones
 * with bookings are archived, so past reservations keep them and reseeding
 * doesn't bring them back; an unused custom one is deleted.
 */
export async function removePlatform(input: { organizationId: string; actorUserId: string; platformId: string }): Promise<{ archived: boolean }> {
  return db.transaction(async (tx) => {
    const platform = await getPlatformOrThrow(tx, input.organizationId, input.platformId);
    if (!platform.isActive) return { archived: true };
    const [active] = await tx
      .select({ total: count() })
      .from(bookingPlatforms)
      .where(and(eq(bookingPlatforms.organizationId, input.organizationId), eq(bookingPlatforms.isActive, true)));
    if ((active?.total ?? 0) <= 1) throw new PlatformError("Keep at least one platform for new reservations.");
    const [used] = await tx
      .select({ total: count() })
      .from(reservations)
      .where(and(eq(reservations.organizationId, input.organizationId), eq(reservations.platformId, platform.id)));
    const archive = platform.key !== null || (used?.total ?? 0) > 0;
    if (archive) {
      await tx.update(bookingPlatforms).set({ isActive: false, updatedAt: new Date() }).where(eq(bookingPlatforms.id, platform.id));
    } else {
      await tx.delete(bookingPlatforms).where(eq(bookingPlatforms.id, platform.id));
    }
    await audit(tx, { ...input, action: archive ? "platform.archived" : "platform.deleted", metadata: { name: platform.name } });
    return { archived: archive };
  });
}

/** Brings an archived platform back, at the end of the list. */
export async function restorePlatform(input: { organizationId: string; actorUserId: string; platformId: string }) {
  await db.transaction(async (tx) => {
    const platform = await getPlatformOrThrow(tx, input.organizationId, input.platformId);
    if (platform.isActive) return;
    const [last] = await tx
      .select({ position: sql<number>`coalesce(max(${bookingPlatforms.position}), -1)::int` })
      .from(bookingPlatforms)
      .where(and(eq(bookingPlatforms.organizationId, input.organizationId), eq(bookingPlatforms.isActive, true)));
    await tx
      .update(bookingPlatforms)
      .set({ isActive: true, position: (last?.position ?? -1) + 1, updatedAt: new Date() })
      .where(eq(bookingPlatforms.id, platform.id));
    await audit(tx, { ...input, action: "platform.restored", metadata: { name: platform.name } });
  });
}

/** Moves an active platform one place up or down the reservation form's list. */
export async function movePlatform(input: { organizationId: string; actorUserId: string; platformId: string; direction: "up" | "down" }) {
  await db.transaction(async (tx) => {
    const platform = await getPlatformOrThrow(tx, input.organizationId, input.platformId);
    const active = await tx
      .select({ id: bookingPlatforms.id })
      .from(bookingPlatforms)
      .where(and(eq(bookingPlatforms.organizationId, input.organizationId), eq(bookingPlatforms.isActive, true)))
      .orderBy(asc(bookingPlatforms.position), asc(sql`lower(${bookingPlatforms.name})`))
      .for("update");
    const order = active.map((row) => row.id);
    const from = order.indexOf(platform.id);
    const to = from + (input.direction === "up" ? -1 : 1);
    if (from < 0 || to < 0 || to >= order.length) return;
    [order[from], order[to]] = [order[to]!, order[from]!];
    // Renumber so ties from older seeds can't make the move a no-op.
    for (const [position, id] of order.entries()) {
      await tx.update(bookingPlatforms).set({ position }).where(eq(bookingPlatforms.id, id));
    }
  });
}
