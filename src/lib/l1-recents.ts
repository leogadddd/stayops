/**
 * This browser's recent L1 organization picks, newest first. Never shared or
 * sent anywhere; cleared on sign-out and whenever a non-L1 user loads the app,
 * so they don't outlive the access that produced them.
 */
const RECENT_KEY = "stayops:l1-recent-organizations";
const RECENT_LIMIT = 6;

export interface RecentOrganization {
  id: string;
  name: string;
}

export function readL1Recents(): RecentOrganization[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is RecentOrganization => typeof item?.id === "string" && typeof item?.name === "string")
      .slice(0, RECENT_LIMIT);
  } catch {
    return [];
  }
}

export function writeL1Recents(items: RecentOrganization[]) {
  try {
    window.localStorage.setItem(
      RECENT_KEY,
      JSON.stringify(items.slice(0, RECENT_LIMIT).map(({ id, name }) => ({ id, name }))),
    );
  } catch {
    // Storage can be blocked (private windows); recents are only a convenience.
  }
}

export function rememberL1Recent(item: RecentOrganization) {
  writeL1Recents([item, ...readL1Recents().filter((recent) => recent.id !== item.id)]);
}

export function clearL1Recents() {
  try {
    window.localStorage.removeItem(RECENT_KEY);
  } catch {
    // Nothing to clear when storage is blocked.
  }
}
