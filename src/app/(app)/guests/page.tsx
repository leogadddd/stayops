import Link from "next/link";
import type { Metadata } from "next";
import { Plus, ArrowUpRight } from "lucide-react";
import { requirePermission } from "@/lib/auth/session";
import { PermissionDenied } from "@/components/app/permission-denied";
import { listGuests } from "@/server/reservations/service";
import { Button, buttonClassName } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageHeading } from "@/components/app/page-heading";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

export const metadata: Metadata = { title: "Guests" };

export default async function GuestsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const membership = await requirePermission("guests.view");
  if (!membership) return <PermissionDenied />;
  const params = await searchParams;
  const guests = await listGuests(membership.organizationId, params.q);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeading title="Guests" description="The people behind every stay. Find contact details and reservation history.">
        <Link href="/reservations/new" className={buttonClassName("clay")}><Plus className="h-4 w-4" aria-hidden />New reservation</Link>
      </PageHeading>
      <Card className="mb-6 px-4 py-4">
        <form method="get" className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1 basis-56">
            <label htmlFor="q" className="mb-1.5 block text-sm font-medium text-ink">Find a guest</label>
            <Input id="q" name="q" defaultValue={params.q ?? ""} placeholder="Name, email or phone" />
          </div>
          <Button type="submit" variant="outline">Search</Button>
          {params.q ? <Link href="/guests" className={buttonClassName("ghost")}>Clear</Link> : null}
        </form>
      </Card>
      {guests.length === 0 ? (
        <EmptyState className="mt-8" title={params.q ? "No guests match" : "No guests yet"} description={params.q ? "Try a different name, email or phone number." : "Guests appear here once you add them to a hold or booking."} />
      ) : (
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-pine/10 px-4 py-4"><h2 className="font-medium text-pine">Guest directory</h2><span className="rounded-full bg-sage/60 px-2.5 py-1 text-xs text-pine">{guests.length} {guests.length === 1 ? "guest" : "guests"}</span></div>
          <Table>
            <TableHeader><TableRow><TableHead>Guest</TableHead><TableHead>Email</TableHead><TableHead>Phone</TableHead><TableHead>Notes</TableHead><TableHead><span className="sr-only">Reservations</span></TableHead></TableRow></TableHeader>
            <TableBody>{guests.map((guest) => (
              <TableRow key={guest.id}>
                <TableCell><div className="flex min-w-44 items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sage/60 text-sm font-medium text-pine" aria-hidden>{guest.name.trim().slice(0, 1)}</span><span className="font-medium text-pine">{guest.name}</span></div></TableCell>
                <TableCell className="text-ink/65">{guest.email ?? "—"}</TableCell>
                <TableCell className="whitespace-nowrap text-ink/65">{guest.phone ?? "—"}</TableCell>
                <TableCell className="min-w-40 max-w-64 break-words text-ink/65">{guest.notes ?? "—"}</TableCell>
                <TableCell className="text-right"><Link href={`/reservations?q=${encodeURIComponent(guest.name)}`} className="inline-flex items-center gap-1 whitespace-nowrap font-medium text-clay hover:underline" aria-label={`View reservations for ${guest.name}`}>Reservations<ArrowUpRight className="h-4 w-4" aria-hidden /></Link></TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
