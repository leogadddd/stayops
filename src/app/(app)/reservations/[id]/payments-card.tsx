import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import {
  PAYMENT_ALLOCATION_LABELS,
  PAYMENT_METHOD_LABELS,
} from "@/lib/labels";
import { formatPHP } from "@/lib/money";
import type { ReservationLedger } from "@/server/payments/service";
import { ProofQueue } from "./proof-queue";

const TIME_LABEL = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function PaymentsCard({
  reservationId,
  ledger,
}: {
  reservationId: string;
  ledger: ReservationLedger;
}) {
  const { balances, payments, refunds, deductions, proofs } = ledger;
  const unverifiedProofs = proofs.filter((proof) => proof.status === "unverified");
  const hasMovements =
    payments.length > 0 || refunds.length > 0 || deductions.length > 0;

  return (
    <Card>
      <CardHeader>
        <h2 className="font-display text-lg text-pine">Payments & balance</h2>
      </CardHeader>
      <CardBody className="space-y-5">
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-ink/60">Booking total</dt>
            <dd className="font-medium text-pine">
              {formatPHP(balances.bookingTotalCents)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink/60">Paid towards booking</dt>
            <dd className="font-medium text-pine">
              {formatPHP(balances.paidBookingCents)}
            </dd>
          </div>
          {balances.refundedBookingCents > 0 ? (
            <div className="flex justify-between">
              <dt className="text-ink/60">Refunded from booking</dt>
              <dd className="font-medium text-clay-deep">
                -{formatPHP(balances.refundedBookingCents)}
              </dd>
            </div>
          ) : null}
          <div className="flex justify-between border-t border-pine/10 pt-2">
            <dt className="font-medium text-ink">
              {balances.bookingBalanceCents >= 0 ? "Balance due" : "Overpaid by"}
            </dt>
            <dd
              className={`font-semibold ${
                balances.bookingBalanceCents >= 0 ? "text-pine" : "text-clay-deep"
              }`}
            >
              {formatPHP(Math.abs(balances.bookingBalanceCents))}
            </dd>
          </div>
        </dl>

        <dl className="space-y-2 border-t border-pine/10 pt-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-ink/60">Refundable deposit required</dt>
            <dd className="font-medium text-pine">
              {formatPHP(balances.depositTotalCents)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink/60">Deposit collected</dt>
            <dd className="font-medium text-pine">
              {formatPHP(balances.paidDepositCents)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink/60">Deposit still held</dt>
            <dd className="font-semibold text-pine">
              {formatPHP(balances.depositHeldCents)}
            </dd>
          </div>
          <p className="pt-1 text-xs text-ink/45">
            The deposit is a refundable liability — it never counts towards the
            booking balance.
          </p>
        </dl>

        {hasMovements ? (
          <div className="space-y-4 border-t border-pine/10 pt-4">
            {payments.length > 0 ? (
              <div>
                <h3 className="text-xs font-medium uppercase tracking-wide text-ink/45">
                  Payments ({payments.length})
                </h3>
                <ul className="mt-2 space-y-2.5">
                  {payments.map((payment) => (
                    <li
                      key={payment.id}
                      className="flex items-start justify-between gap-3 text-sm"
                    >
                      <div>
                        <p className="text-pine">
                          {PAYMENT_METHOD_LABELS[payment.method]}
                          {payment.reference ? ` · ${payment.reference}` : ""}
                        </p>
                        <p className="text-xs text-ink/50">
                          {TIME_LABEL.format(payment.receivedAt)} ·{" "}
                          <Badge tone="neutral">
                            {PAYMENT_ALLOCATION_LABELS[payment.allocation]}
                          </Badge>
                        </p>
                      </div>
                      <p className="font-medium text-pine">
                        {formatPHP(payment.amountCents)}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {refunds.length > 0 ? (
              <div>
                <h3 className="text-xs font-medium uppercase tracking-wide text-ink/45">
                  Refunds ({refunds.length})
                </h3>
                <ul className="mt-2 space-y-2.5">
                  {refunds.map((refund) => (
                    <li
                      key={refund.id}
                      className="flex items-start justify-between gap-3 text-sm"
                    >
                      <div>
                        <p className="text-pine">{refund.reason}</p>
                        <p className="text-xs text-ink/50">
                          {TIME_LABEL.format(refund.refundedAt)} ·{" "}
                          {PAYMENT_METHOD_LABELS[refund.method]} ·{" "}
                          {PAYMENT_ALLOCATION_LABELS[refund.allocation]}
                        </p>
                      </div>
                      <p className="font-medium text-clay-deep">
                        -{formatPHP(refund.amountCents)}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {deductions.length > 0 ? (
              <div>
                <h3 className="text-xs font-medium uppercase tracking-wide text-ink/45">
                  Deposit deductions ({deductions.length})
                </h3>
                <ul className="mt-2 space-y-2.5">
                  {deductions.map((deduction) => (
                    <li
                      key={deduction.id}
                      className="flex items-start justify-between gap-3 text-sm"
                    >
                      <div>
                        <p className="text-pine">{deduction.reason}</p>
                        <p className="text-xs text-ink/50">
                          {TIME_LABEL.format(deduction.createdAt)}
                        </p>
                      </div>
                      <p className="font-medium text-clay-deep">
                        -{formatPHP(deduction.amountCents)}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="border-t border-pine/10 pt-4 text-sm text-ink/55">
            No payments, refunds, or deductions recorded yet.
          </p>
        )}

        {unverifiedProofs.length > 0 ? (
          <div className="border-t border-pine/10 pt-4">
            <ProofQueue
              reservationId={reservationId}
              proofs={unverifiedProofs.map((proof) => ({
                id: proof.id,
                reference: proof.reference,
                note: proof.note,
                createdAt: proof.createdAt,
              }))}
            />
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
