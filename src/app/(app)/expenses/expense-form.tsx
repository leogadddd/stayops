"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label, Select, Textarea } from "@/components/ui/input";
import { EXPENSE_CATEGORY_LABELS } from "@/lib/labels";
import type { ExpenseCategory } from "@/lib/db/schema";
import { createExpenseAction, type ExpenseFormState } from "./actions";
import { useActionFeedback } from "@/hooks/use-action-feedback";

export interface PropertyOption {
  id: string;
  name: string;
}

const EXPENSE_CATEGORIES = Object.keys(EXPENSE_CATEGORY_LABELS) as ExpenseCategory[];

export function ExpenseForm({
  properties,
  unitsByProperty,
  defaultPaidDate,
}: {
  properties: PropertyOption[];
  unitsByProperty: Record<string, { id: string; name: string }[]>;
  defaultPaidDate: string;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<ExpenseFormState, FormData>(
    async (previous, formData) => {
      const result = await createExpenseAction(previous, formData);
      if (result.success) {
        toast.success("Expense recorded.");
        router.push("/expenses");
        router.refresh();
      }
      return result;
    },
    {},
  );
  useActionFeedback(state);
  const [propertyId, setPropertyId] = useState(properties[0]?.id ?? "");

  const unitOptions = unitsByProperty[propertyId] ?? [];

  return (
    <div className="space-y-3">
      {state.success ? (
        <div className="space-y-3">
          <p className="inline-flex items-center gap-1.5 text-sm text-pine" role="status">
            <CheckCircle2 className="h-4 w-4" aria-hidden />
            Expense recorded.
          </p>
          <Link href="/expenses" className="block text-sm text-pine hover:underline">Back to expenses</Link>
        </div>
      ) : (
        <form action={formAction} className="space-y-3">
          <div>
            <Label htmlFor="expense-property">Property</Label>
            <Select
              id="expense-property"
              name="propertyId"
              value={propertyId}
              onChange={(event) => setPropertyId(event.target.value)}
              required
            >
              {properties.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="expense-unit">Unit (optional)</Label>
            <Select id="expense-unit" name="unitId" defaultValue="">
              <option value="">Whole property / no specific unit</option>
              {unitOptions.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="expense-amount">Amount paid (₱)</Label>
              <Input
                id="expense-amount"
                name="amountPesos"
                inputMode="decimal"
                placeholder="e.g. 1,200"
                required
              />
            </div>
            <div>
              <Label htmlFor="expense-date">Date paid</Label>
              <Input
                id="expense-date"
                name="paidDate"
                type="date"
                defaultValue={defaultPaidDate}
                required
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="expense-category">Category</Label>
              <Select id="expense-category" name="category" defaultValue="cleaning">
                {EXPENSE_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {EXPENSE_CATEGORY_LABELS[category]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="expense-classification">Type</Label>
              <Select
                id="expense-classification"
                name="classification"
                defaultValue="operating"
              >
                <option value="operating">Operating (day-to-day)</option>
                <option value="capital">Capital (improvement)</option>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="expense-description">Description</Label>
            <Textarea
              id="expense-description"
              name="description"
              required
              minLength={2}
              maxLength={300}
              placeholder="e.g. Deep clean after checkout — paid cleaner in cash."
              className="min-h-16"
            />
          </div>
          <FieldError message={state.error} />
          <div className="flex flex-wrap items-center gap-4">
            <Button type="submit" variant="clay" disabled={pending}>
              {pending ? "Recording…" : "Record expense"}
            </Button>
            <Link href="/expenses" className="text-sm text-pine hover:underline">Cancel</Link>
          </div>
        </form>
      )}
    </div>
  );
}
