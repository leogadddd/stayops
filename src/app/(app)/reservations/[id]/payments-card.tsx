import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PAYMENT_ALLOCATION_LABELS, PAYMENT_METHOD_LABELS } from "@/lib/labels";
import { formatPHP } from "@/lib/money";
import type { ReservationLedger } from "@/server/payments/service";
import { ProofQueue } from "./proof-queue";

const TIME_LABEL = new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short" });

export function PaymentsCard({ reservationId, ledger, canReviewProofs, canRecord = true }: {
  reservationId: string;
  ledger: ReservationLedger;
  /** payments.update: record or dismiss guest payment proofs. */
  canReviewProofs: boolean;
  canRecord?: boolean;
}) {
  const { balances, payments, refunds, deductions, proofs } = ledger;

  return (
    <Card>
      <CardHeader><h2 className="font-display text-lg text-pine">Payments & balance</h2>
      </CardHeader>
      <CardBody className="space-y-6">
        <div className="grid gap-6 xl:grid-cols-2">
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-ink/60">Booking total</dt><dd className="font-medium text-pine">{formatPHP(balances.bookingTotalCents)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-ink/60">Paid towards booking</dt><dd className="font-medium text-pine">{formatPHP(balances.paidBookingCents)}</dd></div>
            {balances.refundedBookingCents > 0 ? <div className="flex justify-between gap-3"><dt className="text-ink/60">Refunded from booking</dt><dd className="font-medium text-clay-deep">-{formatPHP(balances.refundedBookingCents)}</dd></div> : null}
            <div className="flex justify-between gap-3 rounded-lg bg-sage/35 p-3"><dt className="font-medium text-pine">{balances.bookingBalanceCents >= 0 ? "Balance due" : "Overpaid by"}</dt><dd className="font-semibold text-pine">{formatPHP(Math.abs(balances.bookingBalanceCents))}</dd></div>
          </dl>
          <div>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-ink/60">Refundable deposit required</dt><dd className="font-medium text-pine">{formatPHP(balances.depositTotalCents)}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-ink/60">Deposit collected</dt><dd className="font-medium text-pine">{formatPHP(balances.paidDepositCents)}</dd></div>
              <div className="flex justify-between gap-3 rounded-lg bg-sage/35 p-3"><dt className="font-medium text-pine">Deposit still held</dt><dd className="font-semibold text-pine">{formatPHP(balances.depositHeldCents)}</dd></div>
            </dl>
            <p className="mt-3 text-xs leading-relaxed text-ink/50">The deposit is a refundable liability — it never counts towards the booking balance.</p>
          </div>
        </div>

        <section className="space-y-3 border-t border-pine/10 pt-5">
          <h3 className="text-sm font-medium text-pine">Payments ({payments.length})</h3>
          <Table aria-label="Payments">
            <TableHeader><TableRow><TableHead>Received</TableHead><TableHead>Method / reference</TableHead><TableHead>Towards</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
            <TableBody>
              {payments.length ? payments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell className="whitespace-nowrap text-xs text-ink/60">{TIME_LABEL.format(payment.receivedAt)}</TableCell>
                  <TableCell><p className="text-pine">{PAYMENT_METHOD_LABELS[payment.method]}</p>{payment.reference ? <p className="mt-1 max-w-64 break-words text-xs text-ink/55">{payment.reference}</p> : null}</TableCell>
                  <TableCell><Badge tone="neutral">{PAYMENT_ALLOCATION_LABELS[payment.allocation]}</Badge></TableCell>
                  <TableCell className="whitespace-nowrap text-right font-medium text-pine">{formatPHP(payment.amountCents)}</TableCell>
                </TableRow>
              )) : <TableRow><TableCell colSpan={4} className="text-ink/55">No payments recorded yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-medium text-pine">Refunds ({refunds.length})</h3>
          <Table aria-label="Refunds">
            <TableHeader><TableRow><TableHead>Returned</TableHead><TableHead>Reason / method</TableHead><TableHead>From</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
            <TableBody>
              {refunds.length ? refunds.map((refund) => (
                <TableRow key={refund.id}>
                  <TableCell className="whitespace-nowrap text-xs text-ink/60">{TIME_LABEL.format(refund.refundedAt)}</TableCell>
                  <TableCell><p className="min-w-40 max-w-64 break-words text-pine">{refund.reason}</p><p className="mt-1 text-xs text-ink/55">{PAYMENT_METHOD_LABELS[refund.method]}</p></TableCell>
                  <TableCell><Badge tone="neutral">{PAYMENT_ALLOCATION_LABELS[refund.allocation]}</Badge></TableCell>
                  <TableCell className="whitespace-nowrap text-right font-medium text-clay-deep">-{formatPHP(refund.amountCents)}</TableCell>
                </TableRow>
              )) : <TableRow><TableCell colSpan={4} className="text-ink/55">No refunds recorded yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-medium text-pine">Deposit deductions ({deductions.length})</h3>
          <Table aria-label="Deposit deductions">
            <TableHeader><TableRow><TableHead>Recorded</TableHead><TableHead>Reason</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
            <TableBody>
              {deductions.length ? deductions.map((deduction) => (
                <TableRow key={deduction.id}>
                  <TableCell className="whitespace-nowrap text-xs text-ink/60">{TIME_LABEL.format(deduction.createdAt)}</TableCell>
                  <TableCell className="min-w-40 max-w-64 break-words text-pine">{deduction.reason}</TableCell>
                  <TableCell className="whitespace-nowrap text-right font-medium text-clay-deep">-{formatPHP(deduction.amountCents)}</TableCell>
                </TableRow>
              )) : <TableRow><TableCell colSpan={3} className="text-ink/55">No deductions recorded yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </section>

        {canReviewProofs && proofs.length > 0 ? (
          <div className="border-t border-pine/10 pt-5">
            <ProofQueue reservationId={reservationId} canRecord={canRecord} proofs={proofs.map((proof) => ({ id: proof.id, reference: proof.reference, note: proof.note, createdAt: proof.createdAt, status: proof.status }))} />
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
