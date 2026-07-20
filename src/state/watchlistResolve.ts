/**
 * Which watchlist to trust on load. Extracted so the rule is testable — the
 * bug it exists to prevent was a privacy one.
 *
 * Signed in, read succeeded → the server is authoritative, INCLUDING when it
 * returns empty. Treating "empty" as "no data" is exactly how one account's
 * watchlist used to survive into the next account's session.
 *
 * Signed in, read FAILED (null) → fall back to that user's own local cache
 * rather than wrongly showing an empty list on a network blip.
 *
 * Signed out / demo → the anonymous local list.
 */
export function resolveWatchlist({
  signedIn,
  remote,
  local,
}: {
  signedIn: boolean;
  /** `null` means the read failed; `[]` means genuinely empty. */
  remote: string[] | null;
  local: string[];
}): string[] {
  if (!signedIn) return local;
  if (remote === null) return local; // read failed — keep what we had
  return remote;
}

/** Storage key, namespaced per account so caches can't cross accounts. */
export function watchlistStorageKey(userId: string | null): string {
  return userId ? `oddiq.watchlist.u.${userId}.v1` : 'oddiq.watchlist.anon.v1';
}
