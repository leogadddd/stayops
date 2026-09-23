"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/input";

export default function OnboardingPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(event.currentTarget);
    const res = await fetch("/api/orgs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: String(form.get("name") ?? "") }),
    });
    setPending(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      setError(body?.error ?? "Something went wrong. Please try again.");
      return;
    }
    router.push("/calendar");
    router.refresh();
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-paper px-6">
      <div className="w-full max-w-lg">
        <p className="text-xs font-medium uppercase tracking-[0.25em] text-clay">
          Set up · Step 1 of 1
        </p>
        <h1 className="mt-3 font-display text-4xl text-pine">
          Name your organization
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-ink/60">
          This is usually the name of your hosting business — it appears on
          your calendar and reports. You&apos;ll add properties and units in
          the next step.
        </p>

        <form
          onSubmit={onSubmit}
          className="mt-8 rounded-2xl border border-pine/10 bg-white p-6"
        >
          <Label htmlFor="name">Organization name</Label>
          <Input
            id="name"
            name="name"
            required
            minLength={2}
            maxLength={80}
            placeholder="e.g. Dela Cruz Stays"
            autoFocus
          />
          <FieldError message={error ?? undefined} />
          <Button type="submit" className="mt-5 w-full" disabled={pending}>
            {pending ? "Creating…" : "Create organization"}
          </Button>
        </form>
      </div>
    </main>
  );
}
