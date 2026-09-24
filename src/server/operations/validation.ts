import { z } from "zod";

export class OperationsError extends Error {
  constructor(
    message: string,
    readonly field?: string,
  ) {
    super(message);
    this.name = "OperationsError";
  }
}

export const checkInSchema = z.object({
  note: z
    .string()
    .trim()
    .max(500, "Note must be 500 characters or fewer.")
    .optional(),
});

export const checkOutSchema = z.object({
  note: z
    .string()
    .trim()
    .max(500, "Note must be 500 characters or fewer.")
    .optional(),
  actualCheckoutAt: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Enter the actual check-out date and time.")
    .optional(),
});

export const markReadySchema = z.object({
  overrideReason: z
    .string()
    .trim()
    .max(500, "Reason must be 500 characters or fewer.")
    .optional(),
});

export const taskNotesSchema = z.object({
  notes: z
    .string()
    .trim()
    .max(1000, "Notes must be 1000 characters or fewer.")
    .optional(),
});

const optionalPesos = z
  .string()
  .trim()
  .max(20, "Amount is too long.")
  .optional();

export const damageReportSchema = z.object({
  unitId: z.string().uuid("Choose a unit."),
  reservationId: z.string().uuid().optional(),
  description: z
    .string()
    .trim()
    .min(2, "Describe the damage.")
    .max(1000, "Description must be 1000 characters or fewer."),
  estimatedAmountPesos: optionalPesos,
  actualAmountPesos: optionalPesos,
});

export const resolveDamageSchema = z.object({
  resolutionNote: z
    .string()
    .trim()
    .min(2, "Give a short note on how it was resolved.")
    .max(500, "Note must be 500 characters or fewer."),
  actualAmountPesos: optionalPesos,
});
