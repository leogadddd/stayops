export const THEME_PREFERENCES = ["system", "light", "dark"] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];

/**
 * Per-device preference, kept in a cookie so the root layout can render
 * `<html data-theme>` on the server and the first paint is already right.
 * `system` is resolved in CSS (see the `dark` variant in globals.css).
 */
export const THEME_COOKIE = "stayops-theme";

export function parseThemePreference(value: string | undefined): ThemePreference {
  return value === "light" || value === "dark" ? value : "system";
}

export function applyThemePreference(preference: ThemePreference) {
  document.documentElement.dataset.theme = preference;
  document.cookie = `${THEME_COOKIE}=${preference}; path=/; max-age=31536000; samesite=lax`;
}
