import { z } from "zod";
import { isLocalDate } from "@/lib/dates";
import { CHARGE_TYPES, RESERVATION_STATUSES } from "@/lib/db/schema";
import { recordPaymentSchema } from "@/server/payments/validation";

export class ReservationError extends Error {
  constructor(
    message: string,
    readonly field?: string,
  ) {
    super(message);
    this.name = "ReservationError";
  }
}

const localDateField = z
  .string()
  .refine(isLocalDate, { message: "Use a real calendar date (yyyy-mm-dd)." });

export const guestInputSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Guest name needs at least 2 characters.")
      .max(120, "Guest name must be 120 characters or fewer."),
    email: z
      .string()
      .trim()
      .email("Use a valid email address.")
      .max(200, "Email must be 200 characters or fewer.")
      .optional(),
    phone: z
      .string()
      .trim()
      .max(40, "Phone number must be 40 characters or fewer.")
      .optional(),
    notes: z
      .string()
      .trim()
      .max(2000, "Notes must be 2000 characters or fewer.")
      .optional(),
  })
  .refine((value) => (value.email ?? "") !== "" || (value.phone ?? "") !== "", {
    message: "Add at least one contact method — email or phone.",
    path: ["email"],
  });

export type GuestInput = z.infer<typeof guestInputSchema>;

const centavosInt = z
  .number()
  .int("Amounts must be whole numbers of centavos.")
  .safe("Amount is too large.");

/**
 * One line of the agreed charge snapshot. Discounts carry negative centavos;
 * security deposits are flagged refundable and excluded from booking revenue.
 */
export const chargeLineSchema = z
  .object({
    type: z.enum(CHARGE_TYPES),
    description: z
      .string()
      .trim()
      .min(2, "Describe the charge.")
      .max(200, "Description must be 200 characters or fewer."),
    quantity: z
      .number()
      .int("Quantity must be a whole number.")
      .min(1, "Quantity must be at least 1."),
    unitAmountCents: centavosInt,
  })
  .refine(
    (line) => (line.type === "discount" ? line.unitAmountCents < 0 : line.unitAmountCents >= 0),
    { message: "Discounts must be negative amounts.", path: ["unitAmountCents"] },
  );

export type ChargeLineInput = z.infer<typeof chargeLineSchema>;

export const HOLD_MINUTES_DEFAULT = 24 * 60;
export const HOLD_MINUTES_MAX = 24 * 60;

export const reservationDetailsSchema = z.object({
  unitId: z.string().uuid("Choose a unit."),
  checkIn: localDateField,
  checkOut: localDateField,
  guestCount: z
    .number()
    .int("Guest count must be a whole number.")
    .min(1, "At least one guest.")
    .max(50, "Guest count must be 50 or fewer."),
});

const reservationBaseSchema = reservationDetailsSchema.extend({
  charges: z
    .array(chargeLineSchema)
    .min(1, "Add at least one charge.")
    .max(50, "At most 50 charge lines."),
  occupantNames: z
    .array(z.string().trim().min(2, "Enter each additional guest's full name.").max(120, "Guest names must be 120 characters or fewer."))
    .max(49, "A reservation can list at most 49 additional guests.")
    .default([]),
});

const rangeRefine = (value: { checkIn: string; checkOut: string }) =>
  value.checkOut > value.checkIn;
const occupantCountRefine = (value: { guestCount: number; occupantNames: string[] }) =>
  // Existing API/import callers may not have names yet; when names are
  // supplied, however, require a complete list matching the guest count.
  value.occupantNames.length === 0 || value.occupantNames.length === value.guestCount - 1;

export const createHoldSchema = reservationBaseSchema
  .extend({
    holdMinutes: z
      .number()
      .int("Hold duration must be a whole number of minutes.")
      .min(5, "Holds last at least 5 minutes.")
      .max(HOLD_MINUTES_MAX, "Holds last at most 24 hours.")
      .default(HOLD_MINUTES_DEFAULT),
  })
  .refine(rangeRefine, {
    message: "Check-out must be after check-in.",
    path: ["checkOut"],
  })
  .refine(occupantCountRefine, {
    message: "List every additional guest, or adjust the guest count.",
    path: ["occupantNames"],
  });

export const createConfirmedSchema = reservationBaseSchema
  .extend({
    acknowledgeUnpaid: z.boolean().default(false),
    // Recorded in the same transaction as the confirmed reservation.
    initialPayment: recordPaymentSchema.omit({ idempotencyKey: true }).optional(),
  })
  .refine(rangeRefine, {
    message: "Check-out must be after check-in.",
    path: ["checkOut"],
  })
  .refine(occupantCountRefine, {
    message: "List every additional guest, or adjust the guest count.",
    path: ["occupantNames"],
  });

// Callers may omit occupants for a one-person booking; Zod supplies [].
export type CreateHoldInput = z.input<typeof createHoldSchema>;
export type CreateConfirmedInput = z.input<typeof createConfirmedSchema>;

export const updateReservationSchema = reservationDetailsSchema.extend({
  guestId: z.string().uuid("Choose a primary guest."),
  charges: z.array(chargeLineSchema).min(1, "Keep at least one charge.").max(50, "At most 50 charge lines."),
  occupantNames: z.array(z.string().trim().min(2, "Enter each additional guest's full name.").max(120, "Guest names must be 120 characters or fewer.")).max(49).default([]),
}).refine(rangeRefine, { message: "Check-out must be after check-in.", path: ["checkOut"] })
  .refine(occupantCountRefine, { message: "List every additional guest, or adjust the guest count.", path: ["occupantNames"] });
export type UpdateReservationInput = z.input<typeof updateReservationSchema>;

export const confirmHoldSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(2, "Give a short reason for confirming without a recorded deposit.")
    .max(500, "Reason must be 500 characters or fewer."),
});

export const cancelReservationSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(2, "Give a short reason for the cancellation.")
    .max(500, "Reason must be 500 characters or fewer."),
});

export type ReservationStatusValue = (typeof RESERVATION_STATUSES)[number];

/**
 * Explicit transition map — booking state changes only happen through these
 * edges (PRD §6). checked_in/checked_out edges are exercised from slice 4.
 */
export const ALLOWED_TRANSITIONS: Record<
  ReservationStatusValue,
  readonly ReservationStatusValue[]
> = {
  hold: ["confirmed", "cancelled", "expired"],
  confirmed: ["checked_in", "cancelled"],
  checked_in: ["checked_out"],
  checked_out: [],
  cancelled: [],
  expired: [],
};

export function isAllowedTransition(
  from: ReservationStatusValue,
  to: ReservationStatusValue,
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}
