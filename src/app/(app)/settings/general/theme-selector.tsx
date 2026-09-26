"use client";

import { useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { ChoiceCards, type ChoiceCardOption } from "@/components/ui/choice-cards";
import { applyThemePreference, type ThemePreference } from "@/lib/theme";

const OPTIONS: readonly ChoiceCardOption<ThemePreference>[] = [
  { value: "system", label: "System", description: "Match this device", icon: Monitor },
  { value: "light", label: "Light", description: "Paper and pine", icon: Sun },
  { value: "dark", label: "Dark", description: "Easy on the eyes at night", icon: Moon },
];

/** Applies immediately and is saved on this device only, so there is no save bar. */
export function ThemeSelector({ defaultValue }: { defaultValue: ThemePreference }) {
  const [preference, setPreference] = useState(defaultValue);

  return (
    <div>
      <h2 id="theme-label" className="text-sm font-medium text-pine">Theme</h2>
      <p className="mt-1 text-sm leading-relaxed text-ink/60">
        Choose how StayOps looks on this device.
      </p>
      <ChoiceCards
        aria-labelledby="theme-label"
        value={preference}
        onChange={(next) => {
          setPreference(next);
          applyThemePreference(next);
        }}
        options={OPTIONS}
        columns={3}
        className="mt-4"
      />
    </div>
  );
}
