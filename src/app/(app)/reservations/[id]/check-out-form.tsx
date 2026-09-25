"use client";

import { useActionState, useState } from "react";
import { CheckCircle2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { FieldError, Label, Textarea } from "@/components/ui/input";
import { checkOutAction, type ReservationFormState } from "../actions";
import { useActionFeedback } from "@/hooks/use-action-feedback";
import { useReservationSaved } from "./use-reservation-saved";

const QUICK_NOTES = ["Unit in good shape", "Keys returned", "Left early", "Needs deep clean"];

export function CheckOutForm({ reservationId, timeZone = "Asia/Manila" }: { reservationId: string; timeZone?: string }) {
  const save = useReservationSaved(checkOutAction.bind(null, reservationId), reservationId, "Guest checked out and turnover created.");
  const [state, formAction, pending] = useActionState<ReservationFormState, FormData>(save, {});
  useActionFeedback(state);
  const [note, setNote] = useState("");

  if (state.success) {
    return (
      <p className="inline-flex items-center gap-1.5 text-sm text-pine" role="status">
        <CheckCircle2 className="h-4 w-4" aria-hidden />
        Checked out. The turnover checklist is open under Tasks.
      </p>
    );
  }

  const addNote = (text: string) => setNote((current) => (current.trim() ? `${current.trim().replace(/[.]$/, "")}. ${text}.` : `${text}.`));

  return (
    <form action={formAction} className="space-y-5">
      <DateTimeInput name="actualCheckoutAt" label="Actual check-out" timeZone={timeZone} hint="The turnover starts from this departure time." />
      <div>
        <Label htmlFor="check-out-note">Note (optional)</Label>
        <div className="mb-2 flex flex-wrap gap-2" role="group" aria-label="Quick notes">
          {QUICK_NOTES.map((text) => (
            <button key={text} type="button" onClick={() => addNote(text)} className="rounded-full border border-pine/15 px-3 py-1 text-xs font-medium text-pine transition-colors hover:border-pine/35">
              + {text}
            </button>
          ))}
        </div>
        <Textarea id="check-out-note" name="note" maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} placeholder="e.g. Left at 11 AM, unit in good shape." className="min-h-20" />
      </div>
      <FieldError message={state.error} />
      <Button type="submit" variant="clay" size="lg" disabled={pending} className="w-full">
        <LogOut className="h-4 w-4" aria-hidden />
        {pending ? "Checking out…" : "Check out & start turnover"}
      </Button>
    </form>
  );
}
