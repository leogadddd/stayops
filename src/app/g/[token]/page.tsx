import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { Badge } from "@/components/ui/badge";
import { buttonClassName } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { formatPHP } from "@/lib/money";
import { RESERVATION_STATUS_LABELS } from "@/lib/labels";
import type { ReservationStatus } from "@/lib/db/schema";
import { getGuestViewByToken } from "@/server/reservations/guest-link";

export const metadata: Metadata = {
  title: "Your booking",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export const dynamic = "force-dynamic";

const DATE_LABEL = new Intl.DateTimeFormat("en-PH", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

const STATUS_TONE: Record<string, "sage" | "clay" | "neutral"> = {
  hold: "clay",
  confirmed: "sage",
  checked_in: "sage",
  checked_out: "neutral",
  cancelled: "neutral",
  expired: "neutral",
};

const PROOF_SUBMISSION_STATUSES = new Set([
  "hold",
  "confirmed",
  "checked_in",
]);

export default async function GuestStatusPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const view = await getGuestViewByToken(token);

  return (
    <div className="min-h-dvh bg-paper">
      <header className="border-b border-pine/10 bg-white">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-4">
          <Logo />
          <span className="text-xs text-ink/50">Booking status</span>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-8">
        {!view ? (
          <Card>
            <CardBody className="py-10 text-center">
              <h1 className="font-display text-2xl text-pine">
                This link is not valid
              </h1>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink/60">
                The link may have expired, been replaced by a newer one, or the
                address may be incomplete. Please contact your host for an
                updated link.
              </p>
            </CardBody>
          </Card>
        ) : (
          <div className="space-y-4">
            <div>
              <h1 className="font-display text-2xl text-pine">
                Hi {view.guestName.split(" ")[0]}, your stay
              </h1>
              <p className="mt-1 text-sm text-ink/60">
                {view.propertyName} · {view.unitName}
              </p>
            </div>

            <Card>
              <CardBody className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-pine">
                    {DATE_LABEL.format(new Date(`${view.checkInDate}T00:00:00Z`))}
                  </p>
                  <p className="text-sm text-ink/60">
                    to{" "}
                    {DATE_LABEL.format(new Date(`${view.checkOutDate}T00:00:00Z`))}
                  </p>
                </div>
                <Badge tone={STATUS_TONE[view.status] ?? "neutral"}>
                  {RESERVATION_STATUS_LABELS[view.status as ReservationStatus] ??
                    view.status}
                </Badge>
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <h2 className="font-display text-lg text-pine">Amounts</h2>
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-ink/60">Booking total</dt>
                    <dd className="font-medium text-pine">
                      {formatPHP(view.bookingTotalCents)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-ink/60">Paid towards booking</dt>
                    <dd className="font-medium text-pine">
                      {formatPHP(view.paidBookingCents)}
                    </dd>
                  </div>
                  {view.refundedBookingCents > 0 ? (
                    <div className="flex justify-between">
                      <dt className="text-ink/60">Refunded</dt>
                      <dd className="font-medium text-clay-deep">
                        -{formatPHP(view.refundedBookingCents)}
                      </dd>
                    </div>
                  ) : null}
                  <div className="flex justify-between border-t border-pine/10 pt-2">
                    <dt className="font-medium text-ink">
                      {view.bookingBalanceCents >= 0
                        ? "Balance due"
                        : "Overpaid by"}
                    </dt>
                    <dd
                      className={`font-semibold ${
                        view.bookingBalanceCents >= 0
                          ? "text-pine"
                          : "text-clay-deep"
                      }`}
                    >
                      {formatPHP(Math.abs(view.bookingBalanceCents))}
                    </dd>
                  </div>
                </dl>

                {view.depositTotalCents > 0 || view.depositPaidCents > 0 ? (
                  <dl className="mt-4 space-y-2 border-t border-pine/10 pt-3 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-ink/60">Refundable security deposit</dt>
                      <dd className="font-medium text-pine">
                        {formatPHP(view.depositTotalCents)}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-ink/60">Deposit collected</dt>
                      <dd className="font-medium text-pine">
                        {formatPHP(view.depositPaidCents)}
                      </dd>
                    </div>
                    {view.depositHeldCents !== view.depositPaidCents ? (
                      <div className="flex justify-between">
                        <dt className="text-ink/60">Deposit still held</dt>
                        <dd className="font-medium text-pine">
                          {formatPHP(view.depositHeldCents)}
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                ) : null}

                <p className="mt-3 text-xs text-ink/45">
                  The refundable deposit is separate from the booking balance
                  and comes back after your stay unless there are deductions
                  for damage or extra cleaning.
                </p>
              </CardBody>
            </Card>

            {view.paymentInstructions ? (
              <Card>
                <CardBody>
                  <h2 className="font-display text-lg text-pine">How to pay</h2>
                  <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink/70">
                    {view.paymentInstructions}
                  </p>
                </CardBody>
              </Card>
            ) : null}

            {view.houseRules ? (
              <Card>
                <CardBody>
                  <h2 className="font-display text-lg text-pine">House rules</h2>
                  <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink/70">
                    {view.houseRules}
                  </p>
                </CardBody>
              </Card>
            ) : null}

            {PROOF_SUBMISSION_STATUSES.has(view.status) ? (
              <Card className="bg-sage/35">
                <CardBody>
                  <h2 className="font-display text-lg text-pine">
                    Sent a payment?
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-ink/60">
                    Share the reference number or your sender name so your host
                    can match it to their account.
                  </p>
                  {view.pendingProofs > 0 ? (
                    <p className="mt-2 text-xs text-ink/50">
                      You&apos;ve sent {view.pendingProofs}{" "}
                      {view.pendingProofs === 1 ? "reference" : "references"} —
                      waiting for your host to verify.
                    </p>
                  ) : null}
                  <Link href={`/g/${encodeURIComponent(token)}/payment-proof/new`} prefetch={false} className={buttonClassName("clay", "lg", "mt-4 w-full")}>
                    Submit payment reference
                  </Link>
                  <p className="mt-2 text-xs text-ink/55">Your host verifies payments manually.</p>
                </CardBody>
              </Card>
            ) : null}

            <p className="text-center text-xs text-ink/40">
              Questions? Reply to your host&apos;s message — this page updates
              as your booking changes.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
