import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { formatPercent } from "@/lib/reservation-fee";
import { listManagedPlatforms } from "@/server/reservations/platforms";
import { PermissionDenied } from "@/components/app/permission-denied";
import { PlatformLogo } from "@/components/app/platform-badge";
import { Badge } from "@/components/ui/badge";
import { buttonClassName } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PlatformRowActions, RestorePlatformButton } from "./platform-forms";

export const metadata: Metadata = { title: "Booking platforms" };

export default async function PlatformSettingsPage() {
  const membership = await requirePermission("platforms.view");
  if (!membership) return <PermissionDenied />;
  const platforms = await listManagedPlatforms(membership.organizationId);
  const active = platforms.filter((platform) => platform.isActive);
  const removed = platforms.filter((platform) => !platform.isActive);
  const canCreate = can(membership, "platforms.create");
  const canUpdate = can(membership, "platforms.update");
  const canDelete = can(membership, "platforms.delete");
  const bookings = (count: number) => `${count} ${count === 1 ? "booking" : "bookings"}`;

  return (
    <div className="min-w-0 space-y-6">
      <Card className="overflow-hidden bg-card">
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl text-pine">Booking platforms</h2>
            <p className="mt-1 max-w-xl text-sm text-ink/60">
              Where {membership.organizationName}&apos;s bookings come from. New reservations offer these, in this order; remove the ones you don&apos;t use.
            </p>
          </div>
          {canCreate ? (
            <Link href="/settings/platforms/new" className={buttonClassName("clay", "sm")}>
              <Plus className="h-4 w-4" aria-hidden />
              Add platform
            </Link>
          ) : null}
        </CardHeader>
        <Table aria-label="Booking platforms">
          <TableHeader>
            <TableRow>
              <TableHead>Platform</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead className="text-right">Commission</TableHead>
              <TableHead className="text-right">Used</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {active.map((platform, index) => (
              <TableRow key={platform.id}>
                <TableCell>
                  <span className="flex min-w-0 items-center gap-2.5">
                    <PlatformLogo platform={platform} className="h-7 w-7 rounded-lg text-xs" />
                    <span className="truncate font-medium text-pine">{platform.name}</span>
                    {platform.key === null ? <Badge>Custom</Badge> : null}
                  </span>
                </TableCell>
                <TableCell>
                  {platform.collectsPayment
                    ? <Badge tone="neutral">Platform collects</Badge>
                    : <Badge tone="sage">Reservation fee applies</Badge>}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {platform.commissionBasisPoints === null ? <span className="text-ink/40">—</span> : formatPercent(platform.commissionBasisPoints)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-ink/65">{bookings(platform.reservationCount)}</TableCell>
                <TableCell>
                  {canUpdate || canDelete ? (
                    <PlatformRowActions
                      platform={platform}
                      isFirst={index === 0}
                      isLast={index === active.length - 1}
                      canUpdate={canUpdate}
                      canDelete={canDelete && active.length > 1}
                    />
                  ) : <span className="block text-right text-ink/40">—</span>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {removed.length ? (
        <Card className="overflow-hidden bg-card">
          <CardHeader>
            <h2 className="font-display text-xl text-pine">Removed platforms</h2>
            <p className="mt-1 max-w-xl text-sm text-ink/60">Not offered for new reservations. Past bookings still show where they came from.</p>
          </CardHeader>
          <Table aria-label="Removed platforms">
            <TableBody>
              {removed.map((platform) => (
                <TableRow key={platform.id}>
                  <TableCell>
                    <span className="flex min-w-0 items-center gap-2.5 opacity-70">
                      <PlatformLogo platform={platform} className="h-7 w-7 rounded-lg text-xs" />
                      <span className="truncate font-medium text-pine">{platform.name}</span>
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-ink/65">{bookings(platform.reservationCount)}</TableCell>
                  <TableCell className="w-px text-right">
                    {canUpdate ? <RestorePlatformButton platformId={platform.id} name={platform.name} /> : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : null}

      <Card className="bg-card">
        <CardBody className="text-sm text-ink/65">
          <p><span className="font-medium text-pine">Reservation fee applies</span>: the guest pays you directly, so the unit&apos;s reservation fee must be paid before a booking is confirmed.</p>
          <p className="mt-2"><span className="font-medium text-pine">Platform collects</span>: the platform takes the guest&apos;s payment and pays you out, so no reservation fee is asked for.</p>
        </CardBody>
      </Card>
    </div>
  );
}
