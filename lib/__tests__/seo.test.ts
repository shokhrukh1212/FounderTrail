import assert from "node:assert/strict";
import test from "node:test";
import { config } from "../config";
import { discoveryPageMetadata, publicPageMetadata, siteOpenGraph } from "../seo";
import { resolveSiteUrl } from "../site-url";

test("production URLs never silently fall back to localhost", () => {
  assert.equal(resolveSiteUrl(undefined, true), "https://bidindex.dev");
  assert.equal(resolveSiteUrl("  ", true), "https://bidindex.dev");
  assert.equal(resolveSiteUrl(undefined, false), "http://localhost:3000");
  assert.equal(resolveSiteUrl(" https://bidindex.dev/ ", true), "https://bidindex.dev");
  for (const url of ["http://bidindex.dev", "https://localhost", "https://127.0.0.1", "https://[::1]", "https://dev.localhost"]) {
    assert.throws(() => resolveSiteUrl(url, true), /public HTTPS origin/);
  }
});

test("SITE_URL rejects values that would corrupt canonical and authentication URLs", () => {
  for (const url of ["https://bidindex.dev/product", "https://bidindex.dev?ref=x", "https://bidindex.dev#x", "https://user:password@bidindex.dev", "ftp://bidindex.dev"]) {
    assert.throws(() => resolveSiteUrl(url, true), /HTTP\(S\) origin/);
  }
});

test("public pages use their own canonical and retain the shared social image", () => {
  for (const path of ["/about", "/pricing", "/privacy", "/terms"]) {
    const metadata = publicPageMetadata(path, "Page title", "Page description");
    const expected = new URL(path, config.siteUrl).toString();
    assert.equal(metadata.alternates?.canonical, expected);
    assert.equal(metadata.openGraph?.url, expected);
    assert.deepEqual(metadata.openGraph?.images, siteOpenGraph.images);
    assert.equal(metadata.openGraph?.description, "Page description");
    assert.equal(metadata.twitter?.description, "Page description");
  }
});

test("directory views and pagination have distinct canonicals; tracking and defaults consolidate", () => {
  const canonical = (params: Parameters<typeof discoveryPageMetadata>[0]) => discoveryPageMetadata(params).alternates?.canonical;
  assert.equal(canonical({}), `${config.siteUrl}/`);
  assert.equal(canonical({view:"this_week",page:"1",sort:"most_upvoted"}), `${config.siteUrl}/`);
  assert.equal(canonical({view:"invalid",page:"-5"}), `${config.siteUrl}/`);
  assert.equal(canonical({view:"discover",page:"2"}), `${config.siteUrl}/?view=discover&page=2`);
  assert.equal(canonical({view:"updates",page:"3",category:"ignored",sort:"newest"}), `${config.siteUrl}/?view=updates&page=3`);
  assert.equal(discoveryPageMetadata({view:"discover",page:"2"}).robots, undefined);
});

test("search, filters and alternate sorting do not create indexable directory permutations", () => {
  for (const params of [{view:"discover",q:"test"}, {category:"developer-tools"}, {view:"discover",pricing:"free"}, {sort:"newest"}]) {
    assert.deepEqual(discoveryPageMetadata(params).robots, {index:false,follow:true});
  }
  assert.equal(discoveryPageMetadata({view:"updates",q:"ignored",category:"ignored"}).robots, undefined);
});
