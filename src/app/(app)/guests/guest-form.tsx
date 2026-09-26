"use client";

import { useActionState, useRef } from "react";
import { Flag, Mail, NotebookPen, Phone, UserRound } from "lucide-react";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { useActionFeedback } from "@/hooks/use-action-feedback";
import { useSaveAndReturn } from "@/hooks/use-save-and-return";
import { GUEST_ID_TYPES, GUEST_ID_TYPE_LABELS, parseGuestTags } from "@/lib/guests";
import { createGuestAction, updateGuestAction, type GuestFormState } from "./actions";
import { FormAside, FormLayout, FormSection, useFormValues } from "../properties/form-kit";
import { GuestAvatar, GuestTags } from "./guest-display";

export interface GuestFormValues {
  name: string;
  email: string;
  phone: string;
  notes: string;
  preferredName: string;
  birthDate: string;
  nationality: string;
  idType: string;
  idNumber: string;
  address: string;
  company: string;
  tin: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  tags: string[];
  flagged: boolean;
  flagReason: string;
  marketingOptIn: boolean;
}

const EMPTY: GuestFormValues = {
  name: "",
  email: "",
  phone: "",
  notes: "",
  preferredName: "",
  birthDate: "",
  nationality: "",
  idType: "",
  idNumber: "",
  address: "",
  company: "",
  tin: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  tags: [],
  flagged: false,
  flagReason: "",
  marketingOptIn: false,
};

/** Today in the browser, as the latest selectable birth date. */
function todayLocal() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

export function GuestForm({
  guestId,
  initialValues = EMPTY,
}: {
  /** Present → edit mode; absent → create mode. */
  guestId?: string;
  initialValues?: GuestFormValues;
}) {
  const editing = Boolean(guestId);
  const save = useSaveAndReturn(
    guestId ? updateGuestAction.bind(null, guestId) : createGuestAction,
    (result) => (result.id ? `/guests/${result.id}` : "/guests"),
    editing ? "Guest updated." : "Guest added.",
  );
  const [state, formAction, pending] = useActionState<GuestFormState, FormData>(save, {});
  useActionFeedback(state);
  const formRef = useRef<HTMLFormElement>(null);
  const { values: live, read } = useFormValues(formRef);
  // Checkboxes are missing from FormData when unchecked, so read them once the form has rendered.
  const loaded = Object.keys(live).length > 0;

  const name = live.name?.trim() || initialValues.name || "New guest";
  const preferredName = live.preferredName?.trim() ?? initialValues.preferredName;
  const email = live.email?.trim() ?? initialValues.email;
  const phone = live.phone?.trim() ?? initialValues.phone;
  const notes = live.notes?.trim() ?? initialValues.notes;
  const tags = live.tags !== undefined ? parseGuestTags(live.tags) : initialValues.tags;
  const flagged = loaded ? live.flagged === "on" : initialValues.flagged;

  return (
    <form ref={formRef} action={formAction} onInput={read} onChange={read}>
      <FormLayout
        aside={
          <FormAside
            preview={
              <div className="p-5">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-pine-mist px-2.5 py-0.5 text-xs font-medium text-pine">
                  <UserRound className="h-3.5 w-3.5" aria-hidden />
                  Guest
                </span>
                <div className="mt-4 flex items-center gap-3">
                  <GuestAvatar name={name} size="lg" />
                  <div className="min-w-0">
                    <p className="truncate font-display text-2xl text-pine">{name}</p>
                    {preferredName ? <p className="truncate text-sm text-ink/55">Goes by {preferredName}</p> : null}
                  </div>
                </div>
                {flagged ? (
                  <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-clay-mist px-2.5 py-0.5 text-xs font-medium text-clay-deep">
                    <Flag className="h-3.5 w-3.5" aria-hidden />
                    Flagged
                  </p>
                ) : null}
                <GuestTags tags={tags} className="mt-3" />
                <dl className="mt-4 space-y-2 text-sm">
                  <PreviewRow icon={Mail} label="Email" value={email || "—"} />
                  <PreviewRow icon={Phone} label="Phone" value={phone || "—"} />
                  <PreviewRow icon={NotebookPen} label="Notes" value={notes ? "Added" : "None"} />
                </dl>
              </div>
            }
            error={state.error}
            pending={pending}
            submitLabel={editing ? "Save changes" : "Add guest"}
            pendingLabel="Saving…"
            cancelHref={guestId ? `/guests/${guestId}` : "/guests"}
            note={editing ? "Changes show on every reservation for this guest." : "Only the name and one contact method are required."}
          />
        }
      >
        <FormSection title="Who they are" description="The name on the booking, as the guest gives it.">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="name">Full name</Label>
              <Input id="name" name="name" defaultValue={initialValues.name} required minLength={2} maxLength={120} placeholder="e.g. Maria Santos" autoComplete="off" />
            </div>
            <div>
              <Label htmlFor="preferredName">Preferred name <Optional /></Label>
              <Input id="preferredName" name="preferredName" defaultValue={initialValues.preferredName} maxLength={60} placeholder="e.g. Mia" autoComplete="off" />
            </div>
            <div>
              <Label htmlFor="birthDate">Birth date <Optional /></Label>
              <Input id="birthDate" name="birthDate" type="date" defaultValue={initialValues.birthDate} max={todayLocal()} />
            </div>
            <div>
              <Label htmlFor="nationality">Nationality <Optional /></Label>
              <Input id="nationality" name="nationality" defaultValue={initialValues.nationality} maxLength={60} placeholder="e.g. Filipino" autoComplete="off" />
            </div>
          </div>
        </FormSection>

        <FormSection title="Contact" description="Add at least one of email or phone, so your team can reach them about the stay.">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" defaultValue={initialValues.email} maxLength={200} placeholder="maria@example.com" autoComplete="off" />
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" type="tel" defaultValue={initialValues.phone} maxLength={40} placeholder="+63 917 000 0000" autoComplete="off" />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="address">Home address <Optional /></Label>
              <Textarea id="address" name="address" defaultValue={initialValues.address} maxLength={300} placeholder="Street, barangay, city, country" className="min-h-20" />
            </div>
          </div>
        </FormSection>

        <FormSection title="Identification" description="For building registration and security deposits. Visible to anyone who can see guests.">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="idType">ID type <Optional /></Label>
              <Select id="idType" name="idType" defaultValue={initialValues.idType}>
                <option value="">Not recorded</option>
                {GUEST_ID_TYPES.map((type) => <option key={type} value={type}>{GUEST_ID_TYPE_LABELS[type]}</option>)}
              </Select>
            </div>
            <div>
              <Label htmlFor="idNumber">ID number <Optional /></Label>
              <Input id="idNumber" name="idNumber" defaultValue={initialValues.idNumber} maxLength={60} autoComplete="off" />
            </div>
          </div>
        </FormSection>

        <FormSection title="Emergency contact" description="Who to call if something happens during the stay.">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="emergencyContactName">Name <Optional /></Label>
              <Input id="emergencyContactName" name="emergencyContactName" defaultValue={initialValues.emergencyContactName} maxLength={120} autoComplete="off" />
            </div>
            <div>
              <Label htmlFor="emergencyContactPhone">Phone <Optional /></Label>
              <Input id="emergencyContactPhone" name="emergencyContactPhone" type="tel" defaultValue={initialValues.emergencyContactPhone} maxLength={40} autoComplete="off" />
            </div>
          </div>
        </FormSection>

        <FormSection title="Company & billing" description="For official receipts issued to a company.">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="company">Company <Optional /></Label>
              <Input id="company" name="company" defaultValue={initialValues.company} maxLength={120} autoComplete="off" />
            </div>
            <div>
              <Label htmlFor="tin">TIN <Optional /></Label>
              <Input id="tin" name="tin" defaultValue={initialValues.tin} maxLength={30} placeholder="000-000-000-000" autoComplete="off" />
            </div>
          </div>
        </FormSection>

        <FormSection title="Tags & flags" description="Group guests, and warn your team before rebooking someone.">
          <div className="space-y-5">
            <div>
              <Label htmlFor="tags">Tags <Optional /></Label>
              <Input id="tags" name="tags" defaultValue={initialValues.tags.join(", ")} maxLength={400} placeholder="VIP, returning, corporate" autoComplete="off" />
              <p className="mt-1.5 text-xs text-ink/50">Separate tags with commas. Up to 10.</p>
            </div>
            <label className="flex items-start gap-3">
              <input type="checkbox" name="flagged" defaultChecked={initialValues.flagged} className="mt-0.5 h-4 w-4 accent-clay" />
              <span>
                <span className="block text-sm font-medium text-ink">Flag this guest</span>
                <span className="block text-xs text-ink/55">Shows a warning on their profile and in the guest list.</span>
              </span>
            </label>
            {flagged ? (
              <div>
                <Label htmlFor="flagReason">Why <Optional /></Label>
                <Input id="flagReason" name="flagReason" defaultValue={initialValues.flagReason} maxLength={500} placeholder="e.g. Left the unit damaged in March" autoComplete="off" />
              </div>
            ) : null}
            <label className="flex items-start gap-3">
              <input type="checkbox" name="marketingOptIn" defaultChecked={initialValues.marketingOptIn} className="mt-0.5 h-4 w-4 accent-pine" />
              <span>
                <span className="block text-sm font-medium text-ink">Agreed to promotions</span>
                <span className="block text-xs text-ink/55">Only tick this if the guest said yes to offers and updates.</span>
              </span>
            </label>
          </div>
        </FormSection>

        <FormSection title="Notes" description="Private to your team: preferences, special requests, anything worth remembering next time.">
          <Textarea id="notes" name="notes" aria-label="Notes" defaultValue={initialValues.notes} maxLength={2000} placeholder="Prefers a high floor. Travelling with a small dog…" className="min-h-28" />
        </FormSection>
      </FormLayout>
    </form>
  );
}

function Optional() {
  return <span className="font-normal text-ink/45">· optional</span>;
}

function PreviewRow({ icon: Icon, label, value }: { icon: typeof Mail; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="flex items-center gap-2 text-ink/55">
        <Icon className="h-4 w-4 text-pine/40" aria-hidden />
        {label}
      </dt>
      <dd className="min-w-0 truncate font-medium text-pine">{value}</dd>
    </div>
  );
}
