import { inArray, and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditEvents, paymentEntries, reservations, taskItems, tasks } from "@/lib/db/schema";
import { markTaskReady, setTaskItemCompleted } from "@/server/operations/service";

/** Shared by the demo and sample-data scripts. */

export function assertSafeDatabase() {
  const url = new URL(process.env.DATABASE_URL ?? "");
  const local = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  console.log(`Database: ${url.hostname}:${url.port || 5432}${url.pathname}`);
  if (!local && !process.argv.includes("--allow-remote")) {
    throw new Error("Refusing to write to a non-local database. Pass --allow-remote if you really mean it.");
  }
}

/** Ticks every checklist item and marks the turnover ready, like a finished cleaning. */
export async function finishTurnover(ctx: { organizationId: string; actorUserId: string }, reservationId: string) {
  const openTasks = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(eq(tasks.organizationId, ctx.organizationId), eq(tasks.reservationId, reservationId), eq(tasks.status, "open")));
  for (const task of openTasks) {
    const items = await db
      .select({ id: taskItems.id })
      .from(taskItems)
      .where(and(eq(taskItems.taskId, task.id), isNull(taskItems.completedAt)));
    for (const item of items) {
      await setTaskItemCompleted({ ...ctx, taskId: task.id, itemId: item.id, completed: true });
    }
    await markTaskReady({ ...ctx, canOverrideDamage: true, taskId: task.id, data: {} });
  }
}

/** Hard-deletes reservations and their audit trail; payments, tasks and turnover blocks cascade. */
export async function removeReservations(reservationIds: string[]) {
  if (!reservationIds.length) return;
  const related = await db
    .select({ paymentId: paymentEntries.id })
    .from(paymentEntries)
    .where(inArray(paymentEntries.reservationId, reservationIds));
  const taskIds = (await db.select({ id: tasks.id }).from(tasks).where(inArray(tasks.reservationId, reservationIds))).map((row) => row.id);
  const ids = [...reservationIds, ...related.map((row) => row.paymentId), ...taskIds];
  await db.transaction(async (tx) => {
    await tx.delete(auditEvents).where(inArray(auditEvents.entityId, ids));
    await tx.delete(reservations).where(inArray(reservations.id, reservationIds));
  });
}

/**
 * Where sample bookings come from, by platform key: mostly direct, then the
 * big OTAs, then social and word of mouth. Weights are percentages.
 */
export const SAMPLE_PLATFORM_WEIGHTS: readonly [key: string, weight: number][] = [
  ["direct", 50],
  ["airbnb", 16],
  ["booking_com", 10],
  ["agoda", 6],
  ["facebook", 6],
  ["walk_in", 5],
  ["referral", 4],
  ["instagram", 2],
  ["expedia", 1],
];

/** A stable 0–1 number from a string, so the same reservation always gets the same pick. */
export function unitHash(seed: string) {
  let hash = 2166136261;
  for (const char of seed) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return (hash >>> 0) / 4294967296;
}

/** The platform key at `share` (0–1) along the cumulative SAMPLE_PLATFORM_WEIGHTS. */
export function samplePlatformKey(share: number) {
  const total = SAMPLE_PLATFORM_WEIGHTS.reduce((sum, [, weight]) => sum + weight, 0);
  let pick = share * total;
  for (const [key, weight] of SAMPLE_PLATFORM_WEIGHTS) {
    pick -= weight;
    if (pick < 0) return key;
  }
  return SAMPLE_PLATFORM_WEIGHTS[0]![0];
}

/**
 * Sample platform keys for a set of reservations, in the weights' proportions
 * even for small sets: ids are shuffled by hash, then split by weight.
 */
export function assignSamplePlatforms(ids: readonly string[]): Map<string, string> {
  const shuffled = [...ids].sort((a, b) => unitHash(a) - unitHash(b));
  return new Map(shuffled.map((id, index) => [id, samplePlatformKey((index + 0.5) / shuffled.length)]));
}

/** A seeded random stream (mulberry32), so each reservation's code is varied but repeatable. */
function seededRandom(seed: string) {
  let state = Math.floor(unitHash(seed) * 4294967296);
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A made-up confirmation code in the platform's usual shape; null for the team's own channels. */
export function samplePlatformReference(key: string, seed: string) {
  const random = seededRandom(seed);
  const pick = (alphabet: string, length: number) => Array.from({ length }, () => alphabet[Math.floor(random() * alphabet.length)]).join("");
  // Codes never start with 0, like the real ones.
  const digits = (length: number) => pick("123456789", 1) + pick("0123456789", length - 1);
  switch (key) {
    case "airbnb": return `HM${pick("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 8)}`;
    case "booking_com": return digits(10);
    case "agoda": return digits(9);
    case "expedia": return digits(13);
    default: return null;
  }
}
