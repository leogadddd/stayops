import { z } from "zod";

/**
 * Turnover checklist rules (PRD §3.5). Checkout snapshots the unit's template
 * onto the task, so later template edits never rewrite history.
 */

export interface ChecklistTemplateItem {
  label: string;
  required: boolean;
}

/** PRD §3.5 default checklist; owners may edit the template per unit. */
export const DEFAULT_CHECKLIST: ChecklistTemplateItem[] = [
  { label: "Change bedsheets", required: true },
  { label: "Replace towels", required: true },
  { label: "Clean bathroom", required: true },
  { label: "Clean kitchen", required: true },
  { label: "Clean fridge", required: true },
  { label: "Take out rubbish", required: true },
  { label: "Restock toiletries", required: true },
  { label: "Check Wi-Fi", required: true },
  { label: "Check aircon", required: true },
  { label: "Damage inspection", required: true },
];

export const checklistItemSchema = z.object({
  label: z
    .string()
    .trim()
    .min(1, "Checklist items need a label.")
    .max(120, "Checklist labels must be 120 characters or fewer."),
  required: z.boolean(),
});

export const checklistTemplateSchema = z
  .array(checklistItemSchema)
  .min(1, "Keep at least one checklist item.")
  .max(30, "At most 30 checklist items.");

/**
 * Read boundary for the `units.checklist_template` jsonb column: any legacy or
 * malformed value falls back to the PRD default rather than breaking checkout.
 */
export function normalizeChecklistTemplate(
  value: unknown,
): ChecklistTemplateItem[] {
  const parsed = checklistTemplateSchema.safeParse(value);
  return parsed.success ? parsed.data : DEFAULT_CHECKLIST.map((item) => ({ ...item }));
}

export interface ReadyItemInput {
  label: string;
  required: boolean;
  completed: boolean;
}

export interface ReadyAssessment {
  /** Required items not yet completed — always block mark-ready. */
  missingRequired: string[];
  /** Open damage reports on the unit — block unless the owner overrides. */
  openDamageCount: number;
  /** No missing required items and no open damage. */
  canMarkReady: boolean;
  /** Missing items are done but open damage exists: owner override path. */
  canOverrideDamage: boolean;
}

export function assessReady(
  items: ReadyItemInput[],
  openDamageCount: number,
): ReadyAssessment {
  const missingRequired = items
    .filter((item) => item.required && !item.completed)
    .map((item) => item.label);
  const blockedByDamage = openDamageCount > 0;
  return {
    missingRequired,
    openDamageCount,
    canMarkReady: missingRequired.length === 0 && !blockedByDamage,
    canOverrideDamage: missingRequired.length === 0 && blockedByDamage,
  };
}
