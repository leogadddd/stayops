import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Calendar" };

/**
 * Slice 0 calendar: the shell is real, the inventory behind it lands with
 * slice 1 (properties, units, blocks). The empty state says so honestly.
 */
export default function CalendarPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-pine">Calendar</h1>
          <p className="mt-1 text-sm text-ink/60">
            Availability, holds and reservations across your units.
          </p>
        </div>
      </div>

      <EmptyState
        className="mt-8"
        title="No properties yet"
        description="Your calendar shows availability once you add a property and its first unit. Property and unit setup ships with the inventory slice — set up is next."
        action={
          <Button variant="outline" size="md" disabled>
            Add your first property — coming with inventory
          </Button>
        }
      />

      <p className="mt-4 text-center text-xs text-ink/45">
        Manage your organization under{" "}
        <Link
          href="/settings"
          className="underline underline-offset-2 hover:text-pine"
        >
          Settings
        </Link>
        .
      </p>
    </div>
  );
}
