"use client";

import { useActionState, useState } from "react";
import { BedDouble, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError, Label, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { checkInAction, type ReservationFormState } from "../actions";
import { useActionFeedback } from "@/hooks/use-action-feedback";
import { useReservationSaved } from "./use-reservation-saved";

const QUICK_NOTES = ["Key handed over", "Arrived early", "Arrived late", "ID checked"];

export function CheckInForm({ reservationId }: { reservationId: string }) {
  const save = useReservationSaved(checkInAction.bind(null, reservationId), reservationId, "Guest checked in.");
  const [state, formAction, pending] = useActionState<ReservationFormState, FormData>(save, {});
  useActionFeedback(state);
  const [note, setNote] = useState("");

  if (state.success) {
    return (
      <p className="inline-flex items-center gap-1.5 text-sm text-pine" role="status">
        <CheckCircle2 className="h-4 w-4" aria-hidden />
        Guest checked in.
      </p>
    );
  }

  // Tapping a quick note adds it to what's typed rather than replacing it.
  const addNote = (text: string) => setNote((current) => (current.trim() ? `${current.trim().replace(/[.]$/, "")}. ${text}.` : `${text}.`));

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <Label htmlFor="check-in-note">Note (optional)</Label>
        <div className="mb-2 flex flex-wrap gap-2" role="group" aria-label="Quick notes">
          {QUICK_NOTES.map((text) => (
            <button key={text} type="button" onClick={() => addNote(text)} className={cn("rounded-full border border-pine/15 px-3 py-1 text-xs font-medium text-pine transition-colors hover:border-pine/35")}>
              + {text}
            </button>
          ))}
        </div>
        <Textarea id="check-in-note" name="note" maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} placeholder="e.g. Arrived 2 PM, key handover done." className="min-h-20" />
      </div>
      <FieldError message={state.error} />
      <Button type="submit" variant="clay" size="lg" disabled={pending} className="w-full">
        <BedDouble className="h-4 w-4" aria-hidden />
        {pending ? "Checking in…" : "Check in guest"}
      </Button>
    </form>
  );
}
