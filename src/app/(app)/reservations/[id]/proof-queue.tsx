"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClassName } from "@/components/ui/button";
import { FieldError } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { dismissProofAction, type PaymentFormState } from "./payment-actions";

export interface ProofItem {
  id: string;
  reference: string;
  note: string | null;
  createdAt: Date;
  status: "unverified" | "recorded" | "dismissed";
}

const TIME_LABEL = new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short" });
const STATUS_LABELS = { unverified: "Needs review", recorded: "Recorded", dismissed: "Dismissed" };

export function ProofQueue({ reservationId, proofs, canRecord = true }: {
  reservationId: string;
  proofs: ProofItem[];
  canRecord?: boolean;
}) {
  if (proofs.length === 0) return null;
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-pine">Guest payment references ({proofs.length})</h3>
      <Table aria-label="Guest payment references">
        <TableHeader>
          <TableRow><TableHead>Reference</TableHead><TableHead>Submitted</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Action</TableHead></TableRow>
        </TableHeader>
        <TableBody>
          {proofs.map((proof) => (
            <TableRow key={proof.id}>
              <TableCell>
                <p className="max-w-64 break-words font-medium text-pine">{proof.reference}</p>
                {proof.note ? <p className="mt-1 max-w-64 whitespace-pre-wrap break-words text-xs text-ink/60">{proof.note}</p> : null}
              </TableCell>
              <TableCell className="whitespace-nowrap text-xs text-ink/60">{TIME_LABEL.format(proof.createdAt)}</TableCell>
              <TableCell><Badge tone={proof.status === "unverified" ? "clay" : proof.status === "recorded" ? "sage" : "neutral"}>{STATUS_LABELS[proof.status]}</Badge></TableCell>
              <TableCell>
                {proof.status === "unverified" ? (
                  <div className="flex items-center justify-end gap-2">
                    {canRecord ? <Link href={`/reservations/${reservationId}/proofs/${proof.id}/record`} className={buttonClassName("clay", "sm", "whitespace-nowrap")}>Record payment</Link> : null}
                    <DismissButton reservationId={reservationId} proofId={proof.id} />
                  </div>
                ) : <span className="block text-right text-ink/40">—</span>}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="text-xs text-ink/50">References are guest-submitted evidence — verify the money arrived in your account before recording.</p>
    </div>
  );
}

function DismissButton({ reservationId, proofId }: { reservationId: string; proofId: string }) {
  const [state, formAction, pending] = useActionState<PaymentFormState, FormData>(dismissProofAction.bind(null, reservationId, proofId), {});
  if (state.success) return <span className="text-xs text-ink/50" role="status">Dismissed</span>;
  return (
    <form action={formAction}>
      <Button type="submit" variant="ghost" disabled={pending}>{pending ? "Dismissing…" : "Dismiss"}</Button>
      <FieldError message={state.error} />
    </form>
  );
}
