"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { Plus, RotateCcw, Trash2 } from "lucide-react";
import type { ChargeType } from "@/lib/db/schema";
import { CHARGE_TYPES } from "@/lib/db/schema";
import {
  buildDefaultCharges,
  CHARGE_TYPE_LABELS,
  computeTotals,
  type ChargeLineValues,
} from "@/lib/charges";
import { nightsBetween } from "@/lib/dates";
import {
  centavosToPesosInput,
  formatPHP,
  pesosToCentavos,
} from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { FieldError, Input, Label, Select } from "@/components/ui/input";
import { createReservationAction, type ReservationFormState } from "../actions";

export interface UnitOption {
  id: string;
  label: string;
  capacity: number;
  nightlyRateCents: number | null;
  cleaningFeeCents: number | null;
  securityDepositCents: number | null;
}

interface ChargeDraft {
  key: string;
  type: ChargeType;
  description: string;
  quantity: string;
  amountInput: string;
}

function toDraft(lines: ChargeLineValues[]): ChargeDraft[] {
  return lines.map((line) => ({
    key: crypto.randomUUID(),
    type: line.type,
    description: line.description,
    quantity: String(line.quantity),
    amountInput: centavosToPesosInput(line.unitAmountCents),
  }));
}

function parseDraft(draft: ChargeDraft): ChargeLineValues | null {
  const description = draft.description.trim();
  const quantity = Number(draft.quantity);
  if (description.length < 2) return null;
  if (!Number.isInteger(quantity) || quantity < 1) return null;
  try {
    return {
      type: draft.type,
      description,
      quantity,
      unitAmountCents: pesosToCentavos(draft.amountInput || "0"),
    };
  } catch {
    return null;
  }
}

const HOLD_OPTIONS = [
  { value: "15", label: "15 minutes" },
  { value: "60", label: "1 hour" },
  { value: "240", label: "4 hours" },
  { value: "1440", label: "24 hours" },
];

export function ReservationForm({
  units,
  guests,
  defaultCheckIn,
  defaultCheckOut,
  requestedUnitId,
  isOwner,
}: {
  isOwner: boolean;
  units: UnitOption[];
  guests: { id: string; name: string }[];
  defaultCheckIn: string;
  defaultCheckOut: string;
  requestedUnitId?: string;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<ReservationFormState, FormData>(
    createReservationAction,
    {},
  );

  const [unitId, setUnitId] = useState(
    requestedUnitId && units.some((unit) => unit.id === requestedUnitId)
      ? requestedUnitId
      : (units[0]?.id ?? ""),
  );
  const [checkIn, setCheckIn] = useState(defaultCheckIn);
  const [checkOut, setCheckOut] = useState(defaultCheckOut);
  const [guestMode, setGuestMode] = useState<"existing" | "new">(
    guests.length > 0 ? "existing" : "new",
  );
  const [guestId, setGuestId] = useState(guests[0]?.id ?? "");
  // null = follow the unit/date defaults; any edit forks into a manual set.
  const [customCharges, setCustomCharges] = useState<ChargeDraft[] | null>(
    null,
  );
  const [submitMode, setSubmitMode] = useState<"hold" | "confirmed">("hold");
  const [clientError, setClientError] = useState<string | null>(null);
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const defaultCharges = useMemo(() => {
    const unit = units.find((candidate) => candidate.id === unitId);
    if (!unit || unit.nightlyRateCents === null) return [];
    try {
      return toDraft(
        buildDefaultCharges({
          nightlyRateCents: unit.nightlyRateCents,
          cleaningFeeCents: unit.cleaningFeeCents,
          securityDepositCents: unit.securityDepositCents,
          nights: nightsBetween(checkIn, checkOut),
        }),
      );
    } catch {
      // Invalid date range: show no lines until the dates are fixed.
      return [];
    }
  }, [units, unitId, checkIn, checkOut]);
  const charges = customCharges ?? defaultCharges;

  useEffect(() => {
    if (state.success && state.reservationId) {
      router.push(`/reservations/${state.reservationId}`);
    }
  }, [state, router]);

  const selectedUnit = units.find((unit) => unit.id === unitId);

  const parsed = useMemo(
    () => charges.map((draft) => ({ draft, line: parseDraft(draft) })),
    [charges],
  );
  const submittableLines = parsed
    .map((entry) => entry.line)
    .filter((line): line is ChargeLineValues => line !== null);
  const totals = computeTotals(submittableLines);

  function updateCharge(key: string, patch: Partial<ChargeDraft>) {
    setCustomCharges((current) =>
      (current ?? defaultCharges).map((draft) =>
        draft.key === key ? { ...draft, ...patch } : draft,
      ),
    );
  }

  function addCharge() {
    setCustomCharges((current) => [
      ...(current ?? defaultCharges),
      {
        key: crypto.randomUUID(),
        type: "fee",
        description: "",
        quantity: "1",
        amountInput: "",
      },
    ]);
  }

  function removeCharge(key: string) {
    setCustomCharges((current) =>
      (current ?? defaultCharges).filter((draft) => draft.key !== key),
    );
  }

  function resetCharges() {
    setCustomCharges(null);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    setClientError(null);
    if (!isOwner) return;
    if (submittableLines.length === 0) {
      event.preventDefault();
      setClientError("Add at least one charge with a description, quantity and amount.");
      return;
    }
    const broken = parsed.find((entry) => entry.line === null);
    if (broken) {
      event.preventDefault();
      setClientError(
        `Fix the highlighted charge line (${broken.draft.description.trim() || "no description"}). Amounts look like 5500 or 5,500.50.`,
      );
    }
  }

  if (units.length === 0) {
    return (
      <Card className="mt-6">
        <CardBody>
          <p className="text-sm text-ink/70">
            No units are accepting bookings yet. Activate a unit first, then
            come back to place a hold or booking.
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <form action={formAction} onSubmit={handleSubmit} className="mt-6 space-y-6">
      <input type="hidden" name="chargesJson" value={JSON.stringify(submittableLines)} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />

      <Card>
        <CardHeader>
          <h2 className="font-display text-lg text-pine">Stay details</h2>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="unitId">Unit</Label>
              <Select
                id="unitId"
                name="unitId"
                value={unitId}
                onChange={(event) => setUnitId(event.target.value)}
              >
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.label} · sleeps {unit.capacity}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="guestCount">Guests</Label>
              <Input
                id="guestCount"
                name="guestCount"
                type="number"
                min={1}
                max={selectedUnit?.capacity ?? 50}
                defaultValue={1}
                required
              />
              {selectedUnit ? (
                <p className="mt-1 text-xs text-ink/50">
                  This unit sleeps up to {selectedUnit.capacity}.
                </p>
              ) : null}
            </div>
            <div>
              <Label htmlFor="checkIn">Check-in</Label>
              <Input
                id="checkIn"
                name="checkIn"
                type="date"
                value={checkIn}
                onChange={(event) => setCheckIn(event.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="checkOut">Check-out</Label>
              <Input
                id="checkOut"
                name="checkOut"
                type="date"
                value={checkOut}
                onChange={(event) => setCheckOut(event.target.value)}
                required
              />
              <p className="mt-1 text-xs text-ink/50">
                The check-out day is free for the next guest.
              </p>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="font-display text-lg text-pine">Guest</h2>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <label className="inline-flex items-center gap-2 text-sm text-ink">
              <input
                type="radio"
                name="guestMode"
                value="existing"
                className="accent-pine"
                checked={guestMode === "existing"}
                onChange={() => setGuestMode("existing")}
                disabled={guests.length === 0}
              />
              Existing guest
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-ink">
              <input
                type="radio"
                name="guestMode"
                value="new"
                className="accent-pine"
                checked={guestMode === "new"}
                onChange={() => setGuestMode("new")}
              />
              New guest
            </label>
          </div>

          {guestMode === "existing" ? (
            <div>
              <Label htmlFor="guestId">Guest</Label>
              <Select
                id="guestId"
                name="guestId"
                value={guestId}
                onChange={(event) => setGuestId(event.target.value)}
                required
              >
                {guests.map((guest) => (
                  <option key={guest.id} value={guest.id}>
                    {guest.name}
                  </option>
                ))}
              </Select>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="guestName">Full name</Label>
                <Input id="guestName" name="guestName" required minLength={2} maxLength={120} />
              </div>
              <div>
                <Label htmlFor="guestEmail">Email</Label>
                <Input
                  id="guestEmail"
                  name="guestEmail"
                  type="email"
                  maxLength={200}
                  placeholder="guest@example.com"
                />
              </div>
              <div>
                <Label htmlFor="guestPhone">Phone</Label>
                <Input
                  id="guestPhone"
                  name="guestPhone"
                  type="tel"
                  maxLength={40}
                  placeholder="+63 9xx xxx xxxx"
                />
              </div>
              <div>
                <Label htmlFor="guestNotes">Notes</Label>
                <Input
                  id="guestNotes"
                  name="guestNotes"
                  maxLength={2000}
                  placeholder="Optional"
                />
              </div>
              <p className="text-xs text-ink/50 sm:col-span-2">
                Add at least one contact method — email or phone.
              </p>
            </div>
          )}
        </CardBody>
      </Card>

      {isOwner ? <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg text-pine">Charges</h2>
          {customCharges !== null ? (
            <button
              type="button"
              onClick={resetCharges}
              className="inline-flex items-center gap-1.5 text-sm text-pine/70 underline-offset-4 hover:text-pine hover:underline"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
              Reset to unit defaults
            </button>
          ) : null}
        </CardHeader>
        <CardBody className="space-y-3">
          <ul className="space-y-3">
            {parsed.map(({ draft, line }) => {
              const quantity = Number(draft.quantity);
              const subtotal =
                line && Number.isInteger(quantity) && quantity >= 1
                  ? line.quantity * line.unitAmountCents
                  : null;
              return (
                <li
                  key={draft.key}
                  className="grid grid-cols-2 items-end gap-3 rounded-xl border border-pine/10 p-3 sm:grid-cols-[10rem_1fr_5rem_8rem_6rem_2rem]"
                >
                  <div>
                    <Label>Type</Label>
                    <Select
                      value={draft.type}
                      onChange={(event) =>
                        updateCharge(draft.key, {
                          type: event.target.value as ChargeType,
                        })
                      }
                    >
                      {CHARGE_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {CHARGE_TYPE_LABELS[type]}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <Label>Description</Label>
                    <Input
                      value={draft.description}
                      onChange={(event) =>
                        updateCharge(draft.key, { description: event.target.value })
                      }
                      placeholder={
                        draft.type === "accommodation" ? "Accommodation (3 nights)" : "Describe the charge"
                      }
                    />
                  </div>
                  <div>
                    <Label>Qty</Label>
                    <Input
                      value={draft.quantity}
                      inputMode="numeric"
                      onChange={(event) =>
                        updateCharge(draft.key, { quantity: event.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label>{draft.type === "discount" ? "Amount (₱, negative)" : "Amount (₱)"}</Label>
                    <Input
                      value={draft.amountInput}
                      inputMode="decimal"
                      placeholder="5500"
                      onChange={(event) =>
                        updateCharge(draft.key, { amountInput: event.target.value })
                      }
                    />
                  </div>
                  <p className="text-sm text-ink/70">
                    {subtotal === null ? "—" : formatPHP(subtotal)}
                  </p>
                  <button
                    type="button"
                    onClick={() => removeCharge(draft.key)}
                    aria-label="Remove charge line"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-clay-deep hover:bg-clay-mist"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>

          <Button type="button" variant="outline" size="sm" onClick={addCharge}>
            <Plus className="h-4 w-4" aria-hidden />
            Add charge line
          </Button>

          <dl className="space-y-1.5 border-t border-pine/10 pt-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink/60">Booking total (excl. deposit)</dt>
              <dd className="font-medium text-pine">{formatPHP(totals.bookingTotalCents)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink/60">Refundable deposit</dt>
              <dd className="font-medium text-pine">{formatPHP(totals.depositTotalCents)}</dd>
            </div>
          </dl>
        </CardBody>
      </Card> : <p className="text-sm text-ink/60">Holds use the unit&apos;s default prices. Only the owner can change prices or confirm a booking.</p>}

      <Card>
        <CardHeader>
          <h2 className="font-display text-lg text-pine">How to save it</h2>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="max-w-56">
            <Label htmlFor="holdMinutes">Hold duration</Label>
            <Select id="holdMinutes" name="holdMinutes" defaultValue="1440">
              {HOLD_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <p className="mt-1 text-xs text-ink/50">
              Holds release the dates automatically when they run out.
            </p>
          </div>

          {isOwner && totals.bookingTotalCents > 0 ? (
            <label className="flex items-start gap-2 text-sm text-ink">
              <input
                type="checkbox"
                name="acknowledgeUnpaid"
                className="mt-0.5 accent-pine"
                required={submitMode === "confirmed"}
              />
              <span>
                No payment is recorded yet — the booking total of{" "}
                <strong>{formatPHP(totals.bookingTotalCents)}</strong> is still
                due from the guest.
              </span>
            </label>
          ) : null}

          <FieldError message={clientError ?? state.error} />

          <div className="flex flex-wrap gap-3">
            <Button
              type="submit"
              name="mode"
              value="hold"
              variant="outline"
              disabled={pending}
              onClick={() => setSubmitMode("hold")}
            >
              {pending && submitMode === "hold" ? "Placing hold…" : "Place hold"}
            </Button>
            {isOwner ? (
              <Button
                type="submit"
                name="mode"
                value="confirmed"
                variant="primary"
                disabled={pending}
                onClick={() => setSubmitMode("confirmed")}
              >
                {pending && submitMode === "confirmed"
                  ? "Creating booking…"
                  : "Create confirmed booking"}
              </Button>
            ) : null}
          </div>
        </CardBody>
      </Card>
    </form>
  );
}
