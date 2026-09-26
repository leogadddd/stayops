"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, CreditCard, Pencil, RotateCcw, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonClassName } from "@/components/ui/button";
import { ChoiceCards } from "@/components/ui/choice-cards";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { FieldError, Input, Label } from "@/components/ui/input";
import { PlatformLogo } from "@/components/app/platform-badge";
import { useActionFeedback } from "@/hooks/use-action-feedback";
import { useSaveAndReturn } from "@/hooks/use-save-and-return";
import {
  movePlatformAction,
  removePlatformAction,
  restorePlatformAction,
  type PlatformFormState,
} from "./actions";

export interface PlatformFormValues {
  name: string;
  color: string;
  websiteUrl: string;
  /** Percent as typed, e.g. "15". */
  commissionPercent: string;
  collectsPayment: boolean;
  logoUrl: string | null;
}

const PAYMENT_OPTIONS = [
  { value: "false", label: "Guest pays us", description: "Like Direct, Facebook or Messenger. The unit's reservation fee applies.", icon: Wallet },
  { value: "true", label: "Platform collects payment", description: "Like Airbnb or Agoda. No reservation fee; the platform pays out.", icon: CreditCard },
] as const;

/** Add or edit a booking platform. */
export function PlatformForm({
  action,
  values,
  submitLabel,
  successMessage,
}: {
  action: (state: PlatformFormState, formData: FormData) => Promise<PlatformFormState>;
  values: PlatformFormValues;
  submitLabel: string;
  successMessage: string;
}) {
  const save = useSaveAndReturn(action, "/settings/platforms", successMessage);
  const [state, formAction, pending] = useActionState<PlatformFormState, FormData>(save, {});
  useActionFeedback(state);
  const [name, setName] = useState(values.name);
  const [color, setColor] = useState(values.color || "#2F5D50");
  const [collectsPayment, setCollectsPayment] = useState<"true" | "false">(values.collectsPayment ? "true" : "false");

  return (
    <form action={formAction} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_10rem]">
        <div>
          <Label htmlFor="platform-name">Name</Label>
          <div className="flex items-center gap-2">
            <PlatformLogo platform={{ name: name || "?", logoUrl: values.logoUrl, color }} className="h-9 w-9 rounded-lg text-sm" />
            <Input id="platform-name" name="name" value={name} onChange={(event) => setName(event.target.value)} required minLength={2} maxLength={60} placeholder="e.g. TikTok" />
          </div>
        </div>
        <div>
          <Label htmlFor="platform-color">Color</Label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              aria-label="Pick a color"
              value={/^#[0-9a-fA-F]{6}$/.test(color) ? color : "#2F5D50"}
              onChange={(event) => setColor(event.target.value.toUpperCase())}
              className="h-9 w-9 shrink-0 cursor-pointer rounded-lg border border-pine/15 bg-surface p-0.5"
            />
            <Input id="platform-color" name="color" value={color} onChange={(event) => setColor(event.target.value)} maxLength={7} className="font-mono" />
          </div>
        </div>
      </div>

      <div>
        <p id="platform-payment" className="mb-1.5 text-sm font-medium text-ink">Who collects the guest&apos;s payment?</p>
        <input type="hidden" name="collectsPayment" value={collectsPayment} />
        <ChoiceCards aria-labelledby="platform-payment" value={collectsPayment} onChange={setCollectsPayment} options={PAYMENT_OPTIONS} />
      </div>

      <div className="grid gap-4 sm:grid-cols-[10rem_minmax(0,1fr)]">
        <div>
          <Label htmlFor="platform-commission">Commission <span className="font-normal text-ink/45">(optional)</span></Label>
          <div className="relative">
            <Input id="platform-commission" name="commissionPercent" type="number" inputMode="decimal" min={0} max={100} step={0.01} defaultValue={values.commissionPercent} placeholder="15" className="pr-8 tabular-nums" />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-ink/45">%</span>
          </div>
        </div>
        <div>
          <Label htmlFor="platform-website">Website <span className="font-normal text-ink/45">(optional)</span></Label>
          <Input id="platform-website" name="websiteUrl" type="url" defaultValue={values.websiteUrl} placeholder="https://www.example.com" />
        </div>
      </div>

      <FieldError message={state.error} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="primary" disabled={pending}>{pending ? "Saving…" : submitLabel}</Button>
        <Link href="/settings/platforms" className={buttonClassName("ghost", "md")}>Cancel</Link>
      </div>
    </form>
  );
}

/** Reorder, edit and remove one active platform. */
export function PlatformRowActions({
  platform,
  isFirst,
  isLast,
  canUpdate,
  canDelete,
}: {
  platform: { id: string; name: string; key: string | null; reservationCount: number };
  isFirst: boolean;
  isLast: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [moving, startMove] = useTransition();
  const move = (direction: "up" | "down") =>
    startMove(async () => {
      const result = await movePlatformAction(platform.id, direction);
      if (result.error) toast.error("That didn’t work", { description: result.error });
      router.refresh();
    });
  const keeps = platform.key !== null || platform.reservationCount > 0;

  return (
    <div className="flex items-center justify-end gap-1">
      {canUpdate ? (
        <>
          <Button type="button" variant="ghost" size="sm" aria-label={`Move ${platform.name} up`} disabled={isFirst || moving} onClick={() => move("up")}>
            <ArrowUp className="h-4 w-4" aria-hidden />
          </Button>
          <Button type="button" variant="ghost" size="sm" aria-label={`Move ${platform.name} down`} disabled={isLast || moving} onClick={() => move("down")}>
            <ArrowDown className="h-4 w-4" aria-hidden />
          </Button>
          <Link href={`/settings/platforms/${platform.id}/edit`} aria-label={`Edit ${platform.name}`} className={buttonClassName("ghost", "sm")}>
            <Pencil className="h-4 w-4" aria-hidden />
          </Link>
        </>
      ) : null}
      {canDelete ? (
        <ConfirmationDialog
          trigger={<Trash2 className="h-4 w-4" aria-hidden />}
          triggerSize="sm"
          triggerAriaLabel={`Remove ${platform.name}`}
          title={`Remove ${platform.name}?`}
          description={
            keeps
              ? `It won't be offered for new reservations. ${platform.reservationCount ? `Its ${platform.reservationCount} past ${platform.reservationCount === 1 ? "booking keeps" : "bookings keep"} it, and you` : "You"} can restore it from Removed platforms any time.`
              : "It has no bookings, so it's deleted for good. You can add it again later."
          }
          confirmLabel="Remove platform"
          successMessage={null}
          onConfirm={async () => {
            const result = await removePlatformAction(platform.id);
            if (result.error) throw new Error(result.error);
            toast.success(`${platform.name} removed.`);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

export function RestorePlatformButton({ platformId, name }: { platformId: string; name: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const result = await restorePlatformAction(platformId);
          if (result.error) toast.error("That didn’t work", { description: result.error });
          else toast.success(`${name} restored.`);
          router.refresh();
        })
      }
    >
      <RotateCcw className="h-4 w-4" aria-hidden />
      {pending ? "Restoring…" : "Restore"}
    </Button>
  );
}
