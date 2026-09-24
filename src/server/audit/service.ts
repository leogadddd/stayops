import "server-only";

import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditEvents, user } from "@/lib/db/schema";

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
