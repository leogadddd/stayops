import { formatPHP } from "@/lib/money";

export interface AuditDisplayEvent {
  action: string;
  entity: string;
  entityId: string;
  metadata: Record<string, unknown> | null;
}

const ENTITY_LABELS: Record<string, string> = {
  access_token: "Guest link",
  damage_report: "Damage report",
  deposit_deduction: "Deposit deduction",
  expense: "Expense",
  guest: "Guest",
  membership: "Staff member",
  organization: "Organization",
  payment_entry: "Payment",
  payment_proof: "Payment proof",
  property: "Property",
  refund_entry: "Refund",
  reservation: "Reservation",
  task: "Turnover task",
  unit: "Unit",
  unit_block: "Unit block",
};

function text(metadata: Record<string, unknown> | null, key: string) {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function number(metadata: Record<string, unknown> | null, key: string) {
  const value = metadata?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function boolean(metadata: Record<string, unknown> | null, key: string) {
  const value = metadata?.[key];
  return typeof value === "boolean" ? value : null;
}

function strings(metadata: Record<string, unknown> | null, key: string) {
  const value = metadata?.[key];
  return Array.isArray(value) && value.every((item) => typeof item === "string") ? value : null;
}

function words(value: string) {
  return value.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
}

function shortReference(value: string | null) {
  return value ? `#${value.slice(0, 8)}` : null;
}

function join(parts: Array<string | null>) {
  return parts.filter((part): part is string => Boolean(part)).join(" · ");
}

export function formatAuditTarget(event: AuditDisplayEvent) {
  const kind = ENTITY_LABELS[event.entity] ?? words(event.entity);
  const targetName = text(event.metadata, "name") ?? text(event.metadata, "email");
  return {
    kind,
    label: targetName ?? `${kind} ${shortReference(event.entityId)}`,
  };
}

export function formatAuditDetails(event: AuditDisplayEvent): string | null {
  const metadata = event.metadata;
  const reason = text(metadata, "reason");
  const amount = number(metadata, "amountCents");
  const reservationId = text(metadata, "reservationId");

  switch (event.action) {
    case "property.deleted": {
      const count = number(metadata, "deletedUnitCount");
      const unitNames = strings(metadata, "deletedUnitNames");
      const summary = count === null ? "Removed from active inventory." : `${count} ${count === 1 ? "unit" : "units"} archived with this property.`;
      return unitNames?.length ? `${summary} ${unitNames.join(", ")}.` : summary;
    }
    case "unit.deleted":
      return "Removed from active inventory; historical records were kept.";
    case "unit.status_changed":
      return join([text(metadata, "from") ? words(text(metadata, "from")!) : null, text(metadata, "to") ? `→ ${words(text(metadata, "to")!)}` : null]);
    case "unit_block.created":
    case "unit_block.removed":
      return join([
        text(metadata, "startDate") && text(metadata, "endDate") ? `${text(metadata, "startDate")} → ${text(metadata, "endDate")}` : null,
        reason,
      ]) || null;
    case "reservation.created":
      return join([
        text(metadata, "status") ? words(text(metadata, "status")!) : null,
        text(metadata, "checkIn") && text(metadata, "checkOut") ? `${text(metadata, "checkIn")} → ${text(metadata, "checkOut")}` : null,
      ]) || null;
    case "reservation.confirmed":
    case "reservation.cancelled":
      return reason ? `Reason: ${reason}` : null;
    case "reservation.expired":
      return "Hold expired automatically.";
    case "payment.recorded":
      return join([
        amount === null ? null : formatPHP(amount),
        text(metadata, "allocation") ? words(text(metadata, "allocation")!) : null,
        text(metadata, "method") ? words(text(metadata, "method")!) : null,
      ]) || null;
    case "refund.recorded":
    case "deposit.deducted":
      return join([
        amount === null ? null : formatPHP(amount),
        text(metadata, "allocation") ? words(text(metadata, "allocation")!) : null,
      ]) || null;
    case "expense.created":
      return join([
        amount === null ? null : formatPHP(amount),
        text(metadata, "category") ? words(text(metadata, "category")!) : null,
        text(metadata, "classification") ? words(text(metadata, "classification")!) : null,
      ]) || null;
    case "organization.staff_invited":
    case "organization.staff_removed":
      return join([text(metadata, "name"), text(metadata, "email")]) || null;
    case "organization.permissions_updated": {
      const role = text(metadata, "role");
      const count = (key: string) => (Array.isArray(metadata?.[key]) ? (metadata[key] as unknown[]).length : 0);
      return join([
        role ? words(role) : null,
        count("granted") ? `${count("granted")} granted` : null,
        count("revoked") ? `${count("revoked")} removed` : null,
      ]) || null;
    }
    case "organization.member_role_changed": {
      const from = text(metadata, "fromRole");
      const to = text(metadata, "toRole");
      return join([
        text(metadata, "name"),
        from && to ? `${words(from)} → ${words(to)}` : null,
      ]) || null;
    }
    case "task.item_completed":
    case "task.item_reopened":
      return text(metadata, "label");
    case "task.notes_updated": {
      const hasNotes = boolean(metadata, "hasNotes");
      const characters = number(metadata, "characterCount");
      if (hasNotes === false) return "Notes cleared.";
      return characters === null ? "Notes updated." : `Notes updated · ${characters} characters.`;
    }
    case "task.marked_ready":
      return boolean(metadata, "override") ? "Owner override used because damage remained open." : "All readiness checks passed.";
    case "unit.checklist_updated": {
      const count = number(metadata, "itemCount");
      return count === null ? null : `${count} checklist ${count === 1 ? "item" : "items"}.`;
    }
    case "damage.reported":
      return join([
        text(metadata, "description"),
        number(metadata, "estimatedAmountCents") === null ? null : `Estimate ${formatPHP(number(metadata, "estimatedAmountCents")!)}`,
      ]) || null;
    case "damage.resolved":
      return join([
        text(metadata, "resolutionNote"),
        number(metadata, "actualAmountCents") === null ? null : `Actual ${formatPHP(number(metadata, "actualAmountCents")!)}`,
      ]) || null;
    case "guest_link.created":
    case "guest_link.rotated":
    case "guest_link.revoked":
    case "payment_proof.submitted":
    case "payment_proof.dismissed":
      return reservationId ? `Reservation ${shortReference(reservationId)}` : null;
    default:
      return reason ? `Reason: ${reason}` : null;
  }
}
