import "server-only";

import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { bookingPlatforms } from "@/lib/db/schema";
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
    .select({ id: bookingPlatforms.id, key: bookingPlatforms.key, name: bookingPlatforms.name, logoUrl: bookingPlatforms.logoUrl, color: bookingPlatforms.color, isActive: bookingPlatforms.isActive })
    .from(bookingPlatforms)
    .where(and(...conditions))
    .orderBy(asc(bookingPlatforms.position), asc(sql`lower(${bookingPlatforms.name})`));
}

/**
 * Rejects a platform from another organization, and an inactive one unless
 * the reservation already uses it (`currentPlatformId`), so edits of older
 * bookings still save.
 */
export async function assertPlatform(tx: Executor, organizationId: string, platformId: string | null | undefined, currentPlatformId?: string | null) {
  if (!platformId) return;
  const [platform] = await tx
    .select({ id: bookingPlatforms.id, isActive: bookingPlatforms.isActive })
    .from(bookingPlatforms)
    .where(and(eq(bookingPlatforms.id, platformId), eq(bookingPlatforms.organizationId, organizationId)))
    .limit(1);
  if (!platform || (!platform.isActive && platform.id !== currentPlatformId)) {
    throw new ReservationError("That booking platform is no longer available. Refresh and try again.", "platformId");
  }
}
