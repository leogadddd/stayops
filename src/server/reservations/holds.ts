import "server-only";

import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { reservationTransitions, reservations } from "@/lib/db/schema";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type DbOrTx = Tx | typeof db;

/**
 * Flip expired holds to `expired` with a transition row, in the caller's
 * transaction when one is given. PRD §5: stale holds must be expired in the
 * same transaction before availability is committed — a background job alone
 * is insufficient. Read paths pass no transaction (auto-commit) so calendars
 * and lists never surface a hold that died seconds ago.
 */
export async function expireStaleHolds(
  executor: DbOrTx = db,
  organizationId?: string,
): Promise<number> {
  const now = new Date();
  const conditions = [
    eq(reservations.status, "hold"),
    // ISO string (not a raw Date) so postgres.js binds it without a column
    // mapper in this fragment.
    sql`${reservations.expiresAt} <= ${now.toISOString()}`,
  ];
  if (organizationId) {
    conditions.push(eq(reservations.organizationId, organizationId));
  }

  const expired = await executor
    .update(reservations)
    .set({ status: "expired", updatedAt: now })
    .where(sql`${sql.join(conditions, sql` AND `)}`)
    .returning({ id: reservations.id, organizationId: reservations.organizationId });

  for (const row of expired) {
    await executor.insert(reservationTransitions).values({
      organizationId: row.organizationId,
      reservationId: row.id,
      fromStatus: "hold",
      toStatus: "expired",
      note: "Hold expired automatically.",
    });
  }
  return expired.length;
}
