/**
 * Keeps an invitation code attached while a visitor signs in or registers,
 * so they land on its acceptance screen afterwards.
 */
export function inviteQuery(invite: string | null | undefined): string {
  return invite ? `?invite=${encodeURIComponent(invite)}` : "";
}

export function afterAuthPath(invite: string | null | undefined, fallback: string): string {
  return invite ? `/onboarding${inviteQuery(invite)}` : fallback;
}
