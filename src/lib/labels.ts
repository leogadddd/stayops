import type { UnitStatus } from "@/lib/db/schema";

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
