import type {
  DamageStatus,
  ExpenseCategory,
  PaymentAllocation,
  PaymentMethod,
  ReservationStatus,
  TaskStatus,
  UnitStatus,
} from "@/lib/db/schema";

/** Plain-language labels required by the PRD's status vocabulary. */
export const UNIT_STATUS_LABELS: Record<UnitStatus, string> = {
  renovating: "Renovating",
  furnishing: "Furnishing",
  ready_to_list: "Ready to list",
  active: "Active",
  maintenance: "Maintenance",
  inactive: "Inactive",
};

export const UNIT_STATUS_DESCRIPTIONS: Record<UnitStatus, string> = {
  renovating: "Under renovation; not bookable yet.",
  furnishing: "Being furnished; not bookable yet.",
  ready_to_list: "Ready — flip to Active to accept bookings.",
  active: "Accepts new holds and reservations.",
  maintenance: "Temporarily paused for repairs; existing bookings stay.",
  inactive: "Retired; hidden from new booking flows.",
};

export const RESERVATION_STATUS_LABELS: Record<ReservationStatus, string> = {
  hold: "Hold",
  confirmed: "Confirmed",
  checked_in: "Checked in",
  checked_out: "Checked out",
  cancelled: "Cancelled",
  expired: "Expired",
};

export const RESERVATION_STATUS_DESCRIPTIONS: Record<ReservationStatus, string> = {
  hold: "Dates are held until the hold expires.",
  confirmed: "Booking confirmed; balance may still be due.",
  checked_in: "Guest has checked in.",
  checked_out: "Stay finished; turnover may still be pending.",
  cancelled: "Cancelled; inventory released, ledger entries kept.",
  expired: "Hold expired without confirmation; dates released.",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  gcash: "GCash",
  maya: "Maya",
  bank_transfer: "Bank transfer",
  cash: "Cash",
};

export const PAYMENT_ALLOCATION_LABELS: Record<PaymentAllocation, string> = {
  booking: "Booking payment",
  security_deposit: "Security deposit",
};

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  cleaning: "Cleaning",
  utilities: "Utilities",
  supplies: "Supplies",
  maintenance: "Maintenance",
  internet: "Internet",
  platform_fees: "Platform fees",
  renovation: "Renovation",
  other: "Other",
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  open: "Needs cleaning",
  ready: "Ready",
};

export const DAMAGE_STATUS_LABELS: Record<DamageStatus, string> = {
  open: "Open",
  resolved: "Resolved",
};

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  "organization.created": "Organization created",
  "organization.renamed": "Organization renamed",
  "organization.payment_instructions_updated": "Guest payment instructions updated",
  "organization.staff_invited": "Staff member added",
  "organization.staff_removed": "Staff member removed",
  "property.created": "Property created",
  "property.updated": "Property updated",
  "property.deleted": "Property deleted",
  "unit.created": "Unit created",
  "unit.updated": "Unit updated",
  "unit.deleted": "Unit deleted",
  "unit.status_changed": "Unit status changed",
  "unit.checklist_updated": "Turnover checklist updated",
  "unit_block.created": "Unit blocked",
  "unit_block.removed": "Unit block removed",
  "amenity.created": "Amenity added",
  "guest.created": "Guest added",
  "guest.updated": "Guest details updated",
  "reservation.created": "Reservation or hold created",
  "reservation.confirmed": "Hold confirmed",
  "reservation.cancelled": "Reservation cancelled",
  "reservation.expired": "Hold expired",
  "reservation.checked_in": "Guest checked in",
  "reservation.checked_out": "Guest checked out",
  "guest_link.created": "Guest link created",
  "guest_link.rotated": "Guest link rotated",
  "guest_link.revoked": "Guest link revoked",
  "payment.recorded": "Payment recorded",
  "payment_proof.submitted": "Payment proof submitted",
  "payment_proof.dismissed": "Payment proof dismissed",
  "refund.recorded": "Refund recorded",
  "deposit.deducted": "Deposit deduction recorded",
  "expense.created": "Expense recorded",
  "task.created": "Turnover task created",
  "task.item_completed": "Checklist item completed",
  "task.item_reopened": "Checklist item reopened",
  "task.notes_updated": "Turnover notes updated",
  "task.marked_ready": "Turnover marked ready",
  "damage.reported": "Damage reported",
  "damage.resolved": "Damage resolved",
};
