import Link from "next/link";
import type { Metadata } from "next";
import { requireOwner } from "@/lib/auth/session";
import { EXPENSE_CATEGORY_LABELS } from "@/lib/labels";
import { formatPHP } from "@/lib/money";
import { listExpenses } from "@/server/expenses/service";
import { listProperties } from "@/server/inventory/service";
import { PageHeading } from "@/components/app/page-heading";
import { PermissionDenied } from "@/components/app/permission-denied";
import { Badge } from "@/components/ui/badge";
import { buttonClassName } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Label, Select } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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

  const [properties, expenses] = await Promise.all([
    listProperties(membership.organizationId),
    listExpenses(membership.organizationId, {
      propertyId: propertyFilter || undefined,
      classification: classificationFilter || undefined,
      month: monthFilter || undefined,
    }),
  ]);

  const totalCents = expenses.reduce((sum, expense) => sum + expense.amountCents, 0);
  const hasFilters = Boolean(propertyFilter || classificationFilter || monthFilter);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeading title="Expenses" description="Operating and capital spending across your properties.">
        <Link href="/expenses/new" className={buttonClassName("clay")}>Record expense</Link>
      </PageHeading>

      <form method="GET" className="flex flex-wrap items-end gap-3 rounded-xl border border-pine/10 bg-sage/25 p-4">
        <div className="min-w-44">
          <Label htmlFor="filter-property">Property</Label>
          <Select id="filter-property" name="property" defaultValue={propertyFilter}>
            <option value="">All properties</option>
            {properties.map((property) => (
              <option key={property.id} value={property.id}>{property.name}</option>
            ))}
          </Select>
        </div>
        <div className="min-w-40">
          <Label htmlFor="filter-classification">Type</Label>
          <Select id="filter-classification" name="classification" defaultValue={classificationFilter}>
            <option value="">All types</option>
            <option value="operating">Operating</option>
            <option value="capital">Capital</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="filter-month">Month</Label>
          <Input id="filter-month" name="month" type="month" defaultValue={monthFilter} className="w-40" />
        </div>
        <button type="submit" className={buttonClassName("outline")}>Filter</button>
        {hasFilters ? <Link href="/expenses" className={buttonClassName("ghost")}>Clear</Link> : null}
      </form>

      <div className="mt-6">
        {expenses.length === 0 ? (
          <EmptyState
            title={hasFilters ? "No expenses match those filters" : "No expenses yet"}
            description={hasFilters
              ? "Try widening the filters, or record a new expense."
              : "Record cleaning, utilities, supplies and other spending so you can reconcile later."}
          />
        ) : (
          <>
            <p className="mb-3 text-sm text-ink/60">
              {expenses.length} {expenses.length === 1 ? "entry" : "entries"} ·{" "}
              <span className="font-semibold text-pine">{formatPHP(totalCents)}</span>
            </p>
            <Card>
              <Table aria-label="Expenses">
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">Date</TableHead>
                    <TableHead scope="col">Description</TableHead>
                    <TableHead scope="col">Property</TableHead>
                    <TableHead scope="col" className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell className="whitespace-nowrap text-ink/70">
                        {DATE_LABEL.format(new Date(`${expense.paidDate}T00:00:00Z`))}
                      </TableCell>
                      <TableCell className="min-w-56">
                        <p className="text-pine">{expense.description}</p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-ink/50">
                          <span>{EXPENSE_CATEGORY_LABELS[expense.category as keyof typeof EXPENSE_CATEGORY_LABELS] ?? expense.category}</span>
                          <Badge tone={expense.classification === "capital" ? "clay" : "neutral"}>
                            {CLASSIFICATION_LABELS[expense.classification]}
                          </Badge>
                        </p>
                      </TableCell>
                      <TableCell className="text-ink/70">
                        {expense.propertyName}{expense.unitName ? ` · ${expense.unitName}` : ""}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums text-pine">
                        {formatPHP(expense.amountCents)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
