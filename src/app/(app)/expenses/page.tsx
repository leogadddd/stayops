import type { Metadata } from "next";
import { requireOwner } from "@/lib/auth/session";
import { todayInTimeZone } from "@/lib/dates";
import { EXPENSE_CATEGORY_LABELS } from "@/lib/labels";
import { formatPHP } from "@/lib/money";
import { listExpenses } from "@/server/expenses/service";
import { listOrgUnits, listProperties } from "@/server/inventory/service";
import { PermissionDenied } from "@/components/app/permission-denied";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Label, Select } from "@/components/ui/input";
import { ExpenseForm } from "./expense-form";

export const metadata: Metadata = { title: "Expenses" };

const DATE_LABEL = new Intl.DateTimeFormat("en-PH", {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

const CLASSIFICATION_LABELS = {
  operating: "Operating",
  capital: "Capital",
} as const;

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const membership = await requireOwner();
  if (!membership) {
    return (
      <PermissionDenied description="Expenses are limited to the organization owner. Staff members can use the calendar, reservations, guests and tasks pages." />
    );
  }
  const params = await searchParams;
  const readParam = (key: string) => {
    const value = params[key];
    return typeof value === "string" ? value.trim() : "";
  };
  const propertyFilter = readParam("property");
  const classificationFilter = readParam("classification");
  const monthFilter = readParam("month");

  const [properties, allUnits, expenses] = await Promise.all([
    listProperties(membership.organizationId),
    listOrgUnits(membership.organizationId),
    listExpenses(membership.organizationId, {
      propertyId: propertyFilter || undefined,
      classification: classificationFilter || undefined,
      month: monthFilter || undefined,
    }),
  ]);

  const unitsByProperty: Record<string, { id: string; name: string }[]> = {};
  for (const unit of allUnits) {
    const list = (unitsByProperty[unit.propertyId] ??= []);
    list.push({ id: unit.id, name: unit.name });
  }

  const totalCents = expenses.reduce((sum, expense) => sum + expense.amountCents, 0);
  const hasFilters = Boolean(propertyFilter || classificationFilter || monthFilter);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-pine">Expenses</h1>
          <p className="mt-1 text-sm text-ink/60">
            Operating and capital spending across your properties.
          </p>
        </div>
        {expenses.length > 0 ? (
          <p className="text-sm text-ink/60">
            {expenses.length} {expenses.length === 1 ? "entry" : "entries"} ·{" "}
            <span className="font-semibold text-pine">{formatPHP(totalCents)}</span>
          </p>
        ) : null}
      </div>

      <form method="GET" className="mt-5 flex flex-wrap items-end gap-3">
        <div className="min-w-44">
          <Label htmlFor="filter-property">Property</Label>
          <Select
            id="filter-property"
            name="property"
            defaultValue={propertyFilter}
          >
            <option value="">All properties</option>
            {properties.map((property) => (
              <option key={property.id} value={property.id}>
                {property.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="min-w-40">
          <Label htmlFor="filter-classification">Type</Label>
          <Select
            id="filter-classification"
            name="classification"
            defaultValue={classificationFilter}
          >
            <option value="">All types</option>
            <option value="operating">Operating</option>
            <option value="capital">Capital</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="filter-month">Month</Label>
          <Input
            id="filter-month"
            name="month"
            type="month"
            defaultValue={monthFilter}
            className="w-40"
          />
        </div>
        <button
          type="submit"
          className="h-10 rounded-lg bg-pine px-4 text-sm font-medium text-white hover:bg-pine-soft"
        >
          Filter
        </button>
        {hasFilters ? (
          <a
            href="/expenses"
            className="h-10 inline-flex items-center rounded-lg px-3 text-sm text-pine hover:bg-pine-mist/70"
          >
            Clear
          </a>
        ) : null}
      </form>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {expenses.length === 0 ? (
            <EmptyState
              title={hasFilters ? "No expenses match those filters" : "No expenses yet"}
              description={
                hasFilters
                  ? "Try widening the filters, or record a new expense below."
                  : "Record cleaning, utilities, supplies and other spending so you can reconcile later."
              }
            />
          ) : (
            <Card>
              <CardBody className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs font-medium uppercase tracking-wide text-ink/45">
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Description</th>
                      <th className="px-4 py-3">Property</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-pine/10">
                    {expenses.map((expense) => (
                      <tr key={expense.id}>
                        <td className="whitespace-nowrap px-4 py-3 text-ink/70">
                          {DATE_LABEL.format(new Date(`${expense.paidDate}T00:00:00Z`))}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-pine">{expense.description}</p>
                          <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-ink/50">
                            <span>
                              {EXPENSE_CATEGORY_LABELS[
                                expense.category as keyof typeof EXPENSE_CATEGORY_LABELS
                              ] ?? expense.category}
                            </span>
                            <Badge
                              tone={
                                expense.classification === "capital"
                                  ? "clay"
                                  : "neutral"
                              }
                            >
                              {CLASSIFICATION_LABELS[expense.classification]}
                            </Badge>
                          </p>
                        </td>
                        <td className="px-4 py-3 text-ink/70">
                          {expense.propertyName}
                          {expense.unitName ? ` · ${expense.unitName}` : ""}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-pine">
                          {formatPHP(expense.amountCents)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardBody>
            </Card>
          )}
        </div>

        <div>
          <Card>
            <CardHeader>
              <h2 className="font-display text-lg text-pine">Record expense</h2>
            </CardHeader>
            <CardBody>
              <ExpenseForm
                properties={properties.map((property) => ({
                  id: property.id,
                  name: property.name,
                }))}
                unitsByProperty={unitsByProperty}
                defaultPaidDate={todayInTimeZone("Asia/Manila")}
              />
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
