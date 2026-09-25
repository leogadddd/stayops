import timezoneData from "./timezones.json";

type TimezoneGroup = {
  value: string;
  text: string;
  utc: string[];
};

/**
 * The supported IANA zones, derived from the shared timezone data file.
 * Each zone is listed once even when it appears in more than one UTC group.
 */
export const TIMEZONE_OPTIONS = (() => {
  const seen = new Set<string>();
  const options: Array<{ value: string; label: string }> = [];
  for (const group of timezoneData as TimezoneGroup[]) {
    // The supplied UTC group represents UTC itself through its `value`, while
    // its `utc` array contains the equivalent regional identifiers.
    const zones = group.value === "UTC" ? ["UTC", ...group.utc] : group.utc;
    for (const zone of zones) {
      if (!seen.has(zone)) {
        seen.add(zone);
        options.push({ value: zone, label: `${group.text} · ${zone}` });
      }
    }
  }
  return options;
})();

const supportedTimezones = new Set(TIMEZONE_OPTIONS.map((option) => option.value));

export function isSupportedTimeZone(value: string): boolean {
  return supportedTimezones.has(value);
}
