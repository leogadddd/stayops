export interface SearchableGuest {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
}

/** Lowercase, without accents, so "José" matches "jose". */
function fold(value: string) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * A phone number's national digits: "+63 917 123 4567", "0917-123-4567"
 * and "9171234567" all become "9171234567".
 */
export function phoneDigits(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("63") && digits.length > 10) return digits.slice(2);
  if (digits.startsWith("0")) return digits.slice(1);
  return digits;
}

/** Whether every character of `needle` appears in `haystack` in order ("mrsnts" → "maria santos"). */
function isSubsequence(needle: string, haystack: string) {
  let index = 0;
  for (const char of haystack) {
    if (char === needle[index]) index += 1;
    if (index === needle.length) return true;
  }
  return false;
}

/** How well one query word matches a guest; 0 means not at all. */
function tokenScore(token: string, name: string, words: string[], email: string, phone: string) {
  let best = 0;
  if (words.some((word) => word.startsWith(token))) best = Math.max(best, 100);
  else if (name.includes(token)) best = Math.max(best, 70);
  if (email.startsWith(token)) best = Math.max(best, 80);
  else if (email.includes(token)) best = Math.max(best, 60);
  const digits = phoneDigits(token);
  if (digits.length >= 3 && /^[\d\s()+-]+$/.test(token) && phone.includes(digits)) {
    best = Math.max(best, phone.startsWith(digits) ? 90 : 65);
  }
  // Typos and skipped letters in names, only for words long enough to mean something.
  if (!best && token.length >= 3 && isSubsequence(token, name.replace(/\s+/g, ""))) best = 30;
  return best;
}

/**
 * Guests matching `query` by name, email or phone, best first. Every word
 * of the query must match something, so "ana gmail" narrows to Anas with a
 * Gmail address. An empty query matches nobody.
 */
export function searchGuests<T extends SearchableGuest>(guests: readonly T[], query: string, limit = 8): T[] {
  const tokens = fold(query).trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];
  const scored: { guest: T; score: number }[] = [];
  for (const guest of guests) {
    const name = fold(guest.name);
    const words = name.split(/[\s.'-]+/);
    const email = fold(guest.email ?? "");
    const phone = guest.phone ? phoneDigits(guest.phone) : "";
    let total = 0;
    for (const token of tokens) {
      const score = tokenScore(token, name, words, email, phone);
      if (!score) {
        total = 0;
        break;
      }
      total += score;
    }
    if (total) scored.push({ guest, score: total });
  }
  return scored
    .sort((a, b) => b.score - a.score || a.guest.name.localeCompare(b.guest.name))
    .slice(0, limit)
    .map((entry) => entry.guest);
}
