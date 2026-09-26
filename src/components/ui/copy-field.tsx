"use client";

import { useId, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/input";

/**
 * A read-only value with a Copy button, for secrets shown once (invite links,
 * join codes). The copy result is announced, not only shown by the icon.
 */
export function CopyField({ label, value, hint }: { label: string; value: string; hint?: string }) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setStatus("copied");
    } catch {
      // Clipboard access can be blocked; select the text so Ctrl+C still works.
      input.current?.select();
      setStatus("failed");
    }
  }

  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <input
          ref={input}
          id={id}
          readOnly
          value={value}
          onFocus={(event) => event.currentTarget.select()}
          aria-describedby={hint ? `${id}-hint` : undefined}
          className="h-10 min-w-0 flex-1 rounded-lg border border-pine/20 bg-surface px-3 font-mono text-sm text-ink focus:border-pine focus:outline-none focus:ring-2 focus:ring-sage"
        />
        <Button type="button" variant="outline" onClick={copy} aria-label={`Copy ${label.toLowerCase()}`}>
          {status === "copied" ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
          {status === "copied" ? "Copied" : "Copy"}
        </Button>
      </div>
      {hint ? <p id={`${id}-hint`} className="mt-1.5 text-xs leading-relaxed text-ink/55">{hint}</p> : null}
      <p className="sr-only" role="status" aria-live="polite">
        {status === "copied" ? `${label} copied to clipboard.` : status === "failed" ? "Copy failed. The text is selected; press Control C or Command C to copy it." : ""}
      </p>
      {status === "failed" ? (
        <p className="mt-1.5 text-xs text-clay-deep">Couldn’t copy automatically. The text is selected, so copy it with your keyboard.</p>
      ) : null}
    </div>
  );
}
