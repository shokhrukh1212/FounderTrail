/**
 * One place that decides where sign-in sends someone back to.
 *
 * Four call sites used to build this string by hand, each slightly differently. Anything
 * that is not a same-site absolute path is dropped, because `returnTo` ends up as an OAuth
 * callback target and a value like `//evil.example` or `https://evil.example` would be an
 * open redirect straight out of the sign-in page.
 */
export function safeReturnTo(value: string | null | undefined): string {
  if (!value) return "/";
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return "/";
  return value;
}

/** Build the sign-in URL that comes back to `path` afterwards. */
export function signInUrl(path: string): string {
  return `/sign-in?returnTo=${encodeURIComponent(safeReturnTo(path))}`;
}

/** The sign-in URL that returns to a product's claim section. */
export function claimSignInUrl(slug: string): string {
  return signInUrl(`/product/${encodeURIComponent(slug)}#claim`);
}
