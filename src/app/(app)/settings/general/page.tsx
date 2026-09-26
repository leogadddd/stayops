import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Card, CardBody } from "@/components/ui/card";
import { parseThemePreference, THEME_COOKIE } from "@/lib/theme";
import { ThemeSelector } from "./theme-selector";

export const metadata: Metadata = { title: "General settings" };

/** Personal preferences, plus organization-wide settings that do not fit another category. */
export default async function GeneralSettingsPage() {
  const theme = parseThemePreference((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <Card className="min-w-0 bg-card">
      <CardBody>
        <ThemeSelector defaultValue={theme} />
      </CardBody>
    </Card>
  );
}
