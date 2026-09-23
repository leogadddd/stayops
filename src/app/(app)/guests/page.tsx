import Link from "next/link";
import type { Metadata } from "next";
import { requireMembership } from "@/lib/auth/session";
import { listGuests } from "@/server/reservations/service";
import { Button, buttonClassName } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";

export const metadata: Metadata = { title: "Guests" };

export default async function GuestsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const membership = await requireMembership();
  const params = await searchParams;
  const guests = await listGuests(membership.organizationId, params.q);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-pine">Guests</h1>
          <p className="mt-1 text-sm text-ink/60">
            People who have held or booked any of your units.
          </p>
        </div>
        <Link
          href="/reservations/new"
          className={buttonClassName("primary", "md")}
        >
          New reservation
        </Link>
      </div>

      <Card className="mt-6 px-4 py-4">
        <form method="get" className="flex flex-wrap items-end gap-3">
          <div className="min-w-56 flex-1">
            <label htmlFor="q" className="mb-1.5 block text-sm font-medium text-ink">
              Search
            </label>
            <Input
              id="q"
              name="q"
              defaultValue={params.q ?? ""}
              placeholder="Name, email or phone"
            />
          </div>
          <Button type="submit" variant="outline" size="md">
            Search
          </Button>
          {params.q ? (
            <Link
              href="/guests"
              className="text-sm text-pine/70 underline-offset-4 hover:text-pine hover:underline"
            >
              Clear
            </Link>
          ) : null}
        </form>
      </Card>

      {guests.length === 0 ? (
        <EmptyState
          className="mt-8"
          title={params.q ? "No guests match" : "No guests yet"}
          description={
            params.q
              ? "Try a different name, email or phone number."
              : "Guests appear here once you add them to a hold or booking."
          }
        />
      ) : (
        <Card className="mt-6 overflow-hidden">
          <ul className="divide-y divide-pine/10">
            {guests.map((guest) => (
              <li
                key={guest.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-pine">
                    {guest.name}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-ink/55">
                    {guest.email ?? guest.phone ?? "No contact on file"}
                    {guest.notes ? ` · ${guest.notes}` : ""}
                  </p>
                </div>
                <Link
                  href={`/reservations?q=${encodeURIComponent(guest.name)}`}
                  className="text-sm text-pine/70 underline-offset-4 hover:text-pine hover:underline"
                >
                  View reservations
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
