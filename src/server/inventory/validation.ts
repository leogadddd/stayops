import { z } from "zod";
import { isLocalDate } from "@/lib/dates";
import { UNIT_STATUSES } from "@/lib/db/schema";

export class InventoryError extends Error {
  constructor(
    message: string,
    readonly field?: string,
  ) {
    super(message);
    this.name = "InventoryError";
  }
}

const HM_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidHmTime(value: string): boolean {
  return HM_TIME_PATTERN.test(value);
}

export function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

const localDateField = z
  .string()
  .refine(isLocalDate, { message: "Use a real calendar date (yyyy-mm-dd)." });

const centavosField = (label: string) =>
  z
    .number()
    .int(`${label} must be a whole number of centavos.`)
    .min(0, `${label} cannot be negative.`);

export const propertyInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Property name needs at least 2 characters.")
    .max(120, "Property name must be 120 characters or fewer."),
  address: z
    .string()
    .trim()
    .max(300, "Address must be 300 characters or fewer.")
    .optional(),
  timezone: z
    .string()
    .trim()
    .refine(isValidTimeZone, {
      message: "Use a valid IANA timezone like Asia/Manila.",
    }),
  checkInTime: z
    .string()
    .refine(isValidHmTime, { message: "Use a 24-hour time like 15:00." }),
  checkOutTime: z
    .string()
    .refine(isValidHmTime, { message: "Use a 24-hour time like 11:00." }),
  houseRules: z
    .string()
    .trim()
    .max(2000, "House rules must be 2000 characters or fewer.")
    .optional(),
});

export type PropertyInput = z.infer<typeof propertyInputSchema>;

export const unitInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Unit name needs at least 2 characters.")
    .max(80, "Unit name must be 80 characters or fewer."),
  capacity: z
    .number()
    .int("Capacity must be a whole number.")
    .min(1, "Capacity must be at least 1.")
    .max(50, "Capacity must be 50 or fewer."),
  bedrooms: z
    .number()
    .int("Bedrooms must be a whole number.")
    .min(0, "Bedrooms cannot be negative.")
    .max(20, "Bedrooms must be 20 or fewer."),
  bathrooms: z
    .number()
    .min(0.5, "Bathrooms must be at least 0.5.")
    .max(20, "Bathrooms must be 20 or fewer."),
  defaultNightlyRateCents: centavosField("Nightly rate"),
  cleaningFeeCents: centavosField("Cleaning fee").nullable(),
  securityDepositCents: centavosField("Security deposit").nullable(),
  checkInTime: z.string().default("15:00").refine(isValidHmTime, { message: "Use a 24-hour arrival time like 15:00." }),
  checkOutTime: z.string().default("11:00").refine(isValidHmTime, { message: "Use a 24-hour departure time like 11:00." }),
  status: z.enum(UNIT_STATUSES),
});

export type UnitInput = z.infer<typeof unitInputSchema>;

export const unitBlockInputSchema = z
  .object({
    startDate: localDateField,
    endDate: localDateField,
    reason: z
      .string()
      .trim()
      .min(2, "Give the block a short reason (e.g. AC repair).")
      .max(200, "Reason must be 200 characters or fewer."),
  })
  .refine((value) => value.endDate > value.startDate, {
    message: "The end date must be after the start date.",
    path: ["endDate"],
  });

export type UnitBlockInput = z.infer<typeof unitBlockInputSchema>;

/** Availability check request for one unit and a half-open night range. */
export const availabilityQuerySchema = z
  .object({
    unitId: z.string().uuid("Choose a unit."),
    checkIn: localDateField,
    checkOut: localDateField,
  })
  .refine((value) => value.checkOut > value.checkIn, {
    message: "Check-out must be after check-in.",
    path: ["checkOut"],
  });

export type AvailabilityQuery = z.infer<typeof availabilityQuerySchema>;
