import assert from "node:assert/strict";
import test from "node:test";
import { resolveAbsoluteUrlWithPathname } from "next/dist/lib/metadata/resolvers/resolve-url";
import { assertCanonical } from "../../scripts/check-seo.mjs";

test("SEO checker accepts the homepage canonical emitted by installed Next.js", () => {
  const origin = "https://bidindex.dev";
  const canonical = resolveAbsoluteUrlWithPathname(`${origin}/`, new URL(origin), "/", {
    trailingSlash: false, isStaticMetadataRouteFile: false,
  });
  assert.equal(canonical, origin);
  assert.doesNotThrow(() => assertCanonical(canonical, `${origin}/`, "/"));
  assert.doesNotThrow(() => assertCanonical(`${origin}/`, origin, "/"));
});

test("SEO checker still rejects incorrect canonical origins, paths, and query strings", () => {
  for (const [actual, expected] of [
    ["http://bidindex.dev", "https://bidindex.dev/"],
    ["https://www.bidindex.dev", "https://bidindex.dev/"],
    ["https://bidindex.dev/", "https://bidindex.dev/about"],
    ["https://bidindex.dev/about/", "https://bidindex.dev/about"],
    ["https://bidindex.dev/?view=discover", "https://bidindex.dev/?view=discover&page=2"],
    ["https://bidindex.dev/?view=updates", "https://bidindex.dev/?view=discover"],
  ]) {
    assert.throws(() => assertCanonical(actual, expected, "/"), /incorrect canonical/);
  }
  assert.throws(() => assertCanonical("/about", "https://bidindex.dev/about", "/about"));
});
