import "server-only";

import { createHash, randomBytes } from "crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  accessTokens,
  auditEvents,
  guests,
  organizations,
  properties,
  reservationCharges,
  reservations,
  units,
} from "@/lib/db/schema";
import { computeTotals, getReservationDetail, ReservationError } from "./service";

const TOKEN_TTL_DAYS = 30;
const RAW_TOKEN_BYTES = 24;

// In-memory sliding-window rate limit for the public guest endpoint. Fine
// for the single-deployable V1; a restart resets the counters.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 30;
const rateLimitBuckets = new Map<string, number[]>();

export function hashGuestToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const bucket = (rateLimitBuckets.get(key) ?? []).filter(
    (timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS,
  );
  if (bucket.length >= RATE_LIMIT_MAX) {
    rateLimitBuckets.set(key, bucket);
    return false;
  }
  bucket.push(now);
  rateLimitBuckets.set(key, bucket);
  if (rateLimitBuckets.size > 5_000) {
    for (const [k, v] of rateLimitBuckets) {
      if (v.every((t) => now - t >= RATE_LIMIT_WINDOW_MS)) {
        rateLimitBuckets.delete(k);
      }
    }
  }
  return true;
}

/**
 * Create the guest booking-status link for a reservation. Creating a new
 * link revokes any still-active one (rotate); only the SHA-256 hash of the
 * token is stored. Returns the raw token exactly once, for the owner URL.
 */
export async function createGuestLink(input: {
  organizationId: string;
  actorUserId: string;
  reservationId: string;
}): Promise<{ tokenId: string; token: string }> {
  await getReservationDetail(input.organizationId, input.reservationId);

  return db.transaction(async (tx) => {
    const now = new Date();
    const active = await tx
      .select({ id: accessTokens.id })
      .from(accessTokens)
      .where(
        and(
          eq(accessTokens.reservationId, input.reservationId),
          eq(accessTokens.organizationId, input.organizationId),
          isNull(accessTokens.revokedAt),
          gt(accessTokens.expiresAt, now),
        ),
      );
    for (const row of active) {
      await tx
        .update(accessTokens)
        .set({ revokedAt: now })
        .where(eq(accessTokens.id, row.id));
    }

    const token = randomBytes(RAW_TOKEN_BYTES).toString("base64url");
    const [created] = await tx
      .insert(accessTokens)
      .values({
        organizationId: input.organizationId,
        reservationId: input.reservationId,
        tokenHash: hashGuestToken(token),
        createdBy: input.actorUserId,
        expiresAt: new Date(now.getTime() + TOKEN_TTL_DAYS * 86_400_000),
      })
      .returning({ id: accessTokens.id });
    if (!created) {
      throw new ReservationError("Failed to create the guest link.");
    }
    await tx.insert(auditEvents).values({
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      entity: "access_token",
      entityId: created.id,
      action: active.length > 0 ? "guest_link.rotated" : "guest_link.created",
      metadata: {
        reservationId: input.reservationId,
        revoked: active.length,
      },
    });
    return { tokenId: created.id, token };
  });
}

export async function revokeGuestLink(input: {
  organizationId: string;
  actorUserId: string;
  tokenId: string;
}) {
  await db.transaction(async (tx) => {
    const [token] = await tx
      .select()
      .from(accessTokens)
      .where(
        and(
          eq(accessTokens.id, input.tokenId),
          eq(accessTokens.organizationId, input.organizationId),
        ),
      )
      .limit(1);
    if (!token || token.revokedAt !== null) {
      throw new ReservationError("Guest link not found.", "tokenId");
    }
    await tx
      .update(accessTokens)
      .set({ revokedAt: new Date() })
      .where(eq(accessTokens.id, token.id));
    await tx.insert(auditEvents).values({
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      entity: "access_token",
      entityId: token.id,
      action: "guest_link.revoked",
      metadata: { reservationId: token.reservationId },
    });
  });
}

export interface GuestView {
  guestName: string;
  propertyName: string;
  unitName: string;
  checkInDate: string;
  checkOutDate: string;
  status: string;
  bookingTotalCents: number;
  depositTotalCents: number;
  receivedCents: number;
  paymentInstructions: string | null;
}

/**
 * Resolve a raw guest-link token to its booking summary. Returns null for
 * unknown, revoked, expired or rate-limited tokens — the page shows a single
 * generic message so tokens can't be probed for existence.
 */
export async function getGuestViewByToken(
  token: string,
): Promise<GuestView | null> {
  if (!token || token.length > 200) return null;
  const hash = hashGuestToken(token);
  if (!checkRateLimit(hash)) return null;

  const [row] = await db
    .select()
    .from(accessTokens)
    .where(eq(accessTokens.tokenHash, hash))
    .limit(1);
  if (!row) return null;

  const now = new Date();
  if (row.revokedAt !== null || row.expiresAt <= now) return null;

  const [view] = await db
    .select({
      guestName: guests.name,
      propertyName: properties.name,
      unitName: units.name,
      checkInDate: reservations.checkInDate,
      checkOutDate: reservations.checkOutDate,
      status: reservations.status,
      paymentInstructions: organizations.paymentInstructions,
    })
    .from(reservations)
    .innerJoin(
      guests,
      and(
        eq(reservations.guestId, guests.id),
        eq(reservations.organizationId, guests.organizationId),
      ),
    )
    .innerJoin(
      units,
      and(
        eq(reservations.unitId, units.id),
        eq(reservations.organizationId, units.organizationId),
      ),
    )
    .innerJoin(
      properties,
      and(
        eq(units.propertyId, properties.id),
        eq(properties.organizationId, row.organizationId),
      ),
    )
    .innerJoin(organizations, eq(reservations.organizationId, organizations.id))
    .where(
      and(
        eq(reservations.id, row.reservationId),
        eq(reservations.organizationId, row.organizationId),
      ),
    )
    .limit(1);
  if (!view) return null;

  const chargeRows = await db
    .select({
      type: reservationCharges.type,
      description: reservationCharges.description,
      quantity: reservationCharges.quantity,
      unitAmountCents: reservationCharges.unitAmountCents,
    })
    .from(reservationCharges)
    .where(eq(reservationCharges.reservationId, row.reservationId));
  const { bookingTotalCents, depositTotalCents } = computeTotals(chargeRows);

  await db
    .update(accessTokens)
    .set({ lastUsedAt: now })
    .where(eq(accessTokens.id, row.id));

  return {
    guestName: view.guestName,
    propertyName: view.propertyName,
    unitName: view.unitName,
    checkInDate: view.checkInDate,
    checkOutDate: view.checkOutDate,
    status: view.status,
    bookingTotalCents,
    depositTotalCents,
    // No payment ledger until slice 3; nothing recorded means received = 0.
    receivedCents: 0,
    paymentInstructions: view.paymentInstructions,
  };
}
