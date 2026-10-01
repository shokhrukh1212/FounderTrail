/** SITE_URL is an origin, shared by canonical URLs, auth, email, and redirects. */
export function resolveSiteUrl(value: string | undefined, production: boolean): string {
  const fallback = production ? "https://bidindex.dev" : "http://localhost:3000";
  const url = new URL(value?.trim() || fallback);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password
    || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("SITE_URL must be an HTTP(S) origin without credentials, a path, query, or fragment.");
  }
  const hostname = url.hostname.toLowerCase();
  const local = hostname === "localhost" || hostname.endsWith(".localhost")
    || /^127\./.test(hostname) || hostname === "[::1]" || hostname === "0.0.0.0";
  if (production && (url.protocol !== "https:" || local)) {
    throw new Error("Production SITE_URL must be a public HTTPS origin, such as https://bidindex.dev.");
  }
  return url.origin;
}
