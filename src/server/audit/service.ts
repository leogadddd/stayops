import "server-only";

import { and, count, desc, eq, gte, ilike, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditEvents, user } from "@/lib/db/schema";
import { addDaysLocal, isLocalDate, localDateTimeToUtc } from "@/lib/dates";

export interface AuditListItem {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  metadata: Record<string, unknown> | null;
  actorUserId: string | null;
  actorName: string | null;
  createdAt: Date;
}

export interface AuditLogFilters {
  action?: string;
  actor?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
}

export interface AuditLogPage {
  events: AuditListItem[];
  page: number;
  pageSize: number;
  total: number;
}

const AUDIT_LOG_PAGE_SIZE = 25;
const AUDIT_TIME_ZONE = "Asia/Manila";

/** Converts a Philippine calendar date to the start of that date in UTC. */
function startOfAuditDate(date: string): Date | null {
  return localDateTimeToUtc(`${date}T00:00`, AUDIT_TIME_ZONE);
}

/** Paginated organization audit activity, optionally limited to inclusive dates. */
export async function getAuditLogPage(
  organizationId: string,
  filters: AuditLogFilters = {},
): Promise<AuditLogPage> {
  const requestedPage = Number.isSafeInteger(filters.page) && filters.page! > 0
    ? filters.page!
    : 1;
  const conditions = [eq(auditEvents.organizationId, organizationId)];

  if (filters.action?.trim()) {
    conditions.push(ilike(auditEvents.action, `%${filters.action.trim()}%`));
  }
  if (filters.actor?.trim()) {
    conditions.push(ilike(user.name, `%${filters.actor.trim()}%`));
  }

  if (filters.startDate && isLocalDate(filters.startDate)) {
    const start = startOfAuditDate(filters.startDate);
    if (start) conditions.push(gte(auditEvents.createdAt, start));
  }
  if (filters.endDate && isLocalDate(filters.endDate)) {
    const end = startOfAuditDate(addDaysLocal(filters.endDate, 1));
    if (end) conditions.push(lt(auditEvents.createdAt, end));
  }

  const where = and(...conditions);
  const [{ total: rawTotal } = { total: 0 }] = await db
    .select({ total: count() })
    .from(auditEvents)
    .leftJoin(user, eq(auditEvents.actorUserId, user.id))
    .where(where);
  const total = Number(rawTotal);
  const page = Math.min(requestedPage, Math.max(1, Math.ceil(total / AUDIT_LOG_PAGE_SIZE)));
  const rows = await db
    .select({
      id: auditEvents.id,
      action: auditEvents.action,
      entity: auditEvents.entity,
      entityId: auditEvents.entityId,
      metadata: auditEvents.metadata,
      actorUserId: auditEvents.actorUserId,
      actorName: user.name,
      createdAt: auditEvents.createdAt,
    })
    .from(auditEvents)
    .leftJoin(user, eq(auditEvents.actorUserId, user.id))
    .where(where)
    .orderBy(desc(auditEvents.createdAt))
    .limit(AUDIT_LOG_PAGE_SIZE)
    .offset((page - 1) * AUDIT_LOG_PAGE_SIZE);

  return {
    events: rows.map((row) => ({
      id: row.id,
      action: row.action,
      entity: row.entity,
      entityId: row.entityId,
      metadata: row.metadata as Record<string, unknown> | null,
      actorUserId: row.actorUserId,
      actorName: row.actorName,
      createdAt: row.createdAt,
    })),
    page,
    pageSize: AUDIT_LOG_PAGE_SIZE,
    total,
  };
}

export async function listAuditEvents(
  organizationId: string,
  limit = 50,
): Promise<AuditListItem[]> {
  const rows = await db
    .select({
      id: auditEvents.id,
      action: auditEvents.action,
      entity: auditEvents.entity,
      entityId: auditEvents.entityId,
      metadata: auditEvents.metadata,
      actorUserId: auditEvents.actorUserId,
      actorName: user.name,
      createdAt: auditEvents.createdAt,
    })
    .from(auditEvents)
    .leftJoin(user, eq(auditEvents.actorUserId, user.id))
    .where(eq(auditEvents.organizationId, organizationId))
    .orderBy(desc(auditEvents.createdAt))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    entity: row.entity,
    entityId: row.entityId,
    metadata: row.metadata as Record<string, unknown> | null,
    actorUserId: row.actorUserId,
    actorName: row.actorName,
    createdAt: row.createdAt,
  }));
}
