import { z } from "zod";
import { isLocalDate } from "@/lib/dates";
import { CHARGE_TYPES, RESERVATION_STATUSES } from "@/lib/db/schema";
import { recordPaymentSchema } from "@/server/payments/validation";
import { GUEST_ID_TYPES, GUEST_TAG_LIMIT } from "@/lib/guests";

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

const optionalText = (label: string, max: number) =>
  z.string().trim().max(max, `${label} must be ${max} characters or fewer.`).optional();

/**
 * A full guest profile, as the Guests pages edit it: the booking contact
 * plus optional details the team keeps. The reservation flow only ever asks
 * for the contact fields (guestInputSchema).
 */
export const guestProfileSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Guest name needs at least 2 characters.")
      .max(120, "Guest name must be 120 characters or fewer."),
    email: z.string().trim().email("Use a valid email address.").max(200, "Email must be 200 characters or fewer.").optional(),
    phone: optionalText("Phone number", 40),
    notes: optionalText("Notes", 2000),
    preferredName: optionalText("Preferred name", 60),
    birthDate: localDateField.optional(),
    nationality: optionalText("Nationality", 60),
    idType: z.enum(GUEST_ID_TYPES, { message: "Choose an ID type from the list." }).optional(),
    idNumber: optionalText("ID number", 60),
    address: optionalText("Address", 300),
    company: optionalText("Company", 120),
    tin: optionalText("TIN", 30),
    emergencyContactName: optionalText("Emergency contact name", 120),
    emergencyContactPhone: optionalText("Emergency contact phone", 40),
    tags: z
      .array(z.string().trim().min(1).max(30, "Tags must be 30 characters or fewer."))
      .max(GUEST_TAG_LIMIT, `Use at most ${GUEST_TAG_LIMIT} tags.`)
      .default([]),
    flagged: z.boolean().default(false),
    flagReason: optionalText("Flag reason", 500),
    marketingOptIn: z.boolean().default(false),
  })
  .refine((value) => (value.email ?? "") !== "" || (value.phone ?? "") !== "", {
    message: "Add at least one contact method — email or phone.",
    path: ["email"],
  })
  .refine((value) => !value.birthDate || value.birthDate <= new Date().toISOString().slice(0, 10), {
    message: "Birth date can't be in the future.",
    path: ["birthDate"],
  })
  .refine((value) => !value.idNumber || value.idType, {
    message: "Choose the ID type for this ID number.",
    path: ["idType"],
  });

export type GuestProfileInput = z.input<typeof guestProfileSchema>;

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
  // Where the booking came from, and that platform's own confirmation code.
  platformId: z.string().uuid("Choose a booking platform.").optional(),
  platformReference: z
    .string()
    .trim()
    .max(80, "Platform booking codes must be 80 characters or fewer.")
    .optional(),
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
  // An existing guest, optionally with edited contact details, or no guestId
  // and a primaryGuest to create a new guest profile.
  guestId: z.string().uuid("Choose a primary guest.").optional(),
  primaryGuest: guestInputSchema.optional(),
  charges: z.array(chargeLineSchema).min(1, "Keep at least one charge.").max(50, "At most 50 charge lines."),
  occupantNames: z.array(z.string().trim().min(2, "Enter each additional guest's full name.").max(120, "Guest names must be 120 characters or fewer.")).max(49).default([]),
}).refine(rangeRefine, { message: "Check-out must be after check-in.", path: ["checkOut"] })
  .refine(occupantCountRefine, { message: "List every additional guest, or adjust the guest count.", path: ["occupantNames"] })
  .refine((value) => value.guestId || value.primaryGuest, { message: "Choose a primary guest.", path: ["guestId"] });
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
