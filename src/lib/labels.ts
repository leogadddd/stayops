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
