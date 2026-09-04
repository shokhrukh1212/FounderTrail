import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { pageWindow } from "../discovery-pagination";

const homepage = readFileSync(new URL("../../app/page.tsx", import.meta.url), "utf8");
const productRow = readFileSync(new URL("../../components/ProductRow.tsx", import.meta.url), "utf8");
const productData = readFileSync(new URL("../product-data.ts", import.meta.url), "utf8");
const voteRoute = readFileSync(new URL("../../app/api/products/[slug]/vote/route.ts", import.meta.url), "utf8");
const requestSecurity = readFileSync(new URL("../request-security.ts", import.meta.url), "utf8");

test("the pager shows every page while the list is short", () => {
  assert.deepEqual(pageWindow(1, 1), [1]);
  assert.deepEqual(pageWindow(1, 3), [1, 2, 3]);
  assert.deepEqual(pageWindow(3, 3), [1, 2, 3]);
});

test("a long list keeps the ends and a window around the current page", () => {
  assert.deepEqual(pageWindow(1, 20), [1, 2, 3, 4, null, 20]);
  assert.deepEqual(pageWindow(10, 20), [1, null, 9, 10, 11, null, 20]);
  assert.deepEqual(pageWindow(20, 20), [1, null, 17, 18, 19, 20]);
});

test("page numbers are unique, ascending and always contain the current page", () => {
  for (const pageCount of [1, 2, 5, 9, 40]) {
    for (let page = 1; page <= pageCount; page++) {
      const numbers = pageWindow(page, pageCount).filter((item): item is number => item !== null);
      assert.ok(numbers.includes(page), `page ${page} of ${pageCount} is missing from its own pager`);
      assert.deepEqual(numbers, [...new Set(numbers)].sort((a, b) => a - b));
      assert.ok(numbers.every((number) => number >= 1 && number <= pageCount));
    }
  }
});

test("discovery counts the whole view, not just the page it renders", () => {
  // The homepage listed a single page with no total, so 30 of 69 products looked like
  // the whole index. Count and page must come from the same filters.
  assert.match(productData, /function discoveryFilters\(/);
  assert.match(productData, /SELECT count\(\*\)::int AS total FROM products p WHERE \$\{where\}/);
  assert.match(productData, /LIMIT \$\$\{params\.length \+ 1\} OFFSET \$\$\{params\.length \+ 2\}/);
  assert.match(homepage, /Showing <strong>\{offset \+ 1\}–\{offset \+ products\.length\}<\/strong> of <strong>\{total\}<\/strong>/);
});

test("the total sits with the pager under the list, and shows on a single page too", () => {
  const footer = homepage.slice(homepage.indexOf("discovery-footer"));
  assert.ok(footer.indexOf("pagination") < footer.indexOf("discovery-count"), "the count belongs below the pager");
  assert.match(homepage, /\{total \? \(\s*<footer className="discovery-footer">/);
  assert.match(homepage, /\{pageCount > 1 \? \(\s*<nav className="pagination"/);
});

test("list positions and pager links keep counting across pages", () => {
  assert.match(homepage, /position=\{offset \+ index \+ 1\}/);
  assert.match(homepage, /if \(target > 1\) linkParams\.set\("page", String\(target\)\)/);
  assert.match(homepage, /className="pagination"/);
});

test("no discovery copy claims a time window", () => {
  // "Trending this week" over all 71 products read as a filter that was not there, and
  // weekly numbers say little while most products are days old. The UI states neither.
  assert.match(homepage, /\{ view: "trending", label: "Trending" \}/);
  assert.doesNotMatch(homepage, /this week/i);
  assert.doesNotMatch(productRow, /this week/i);
});

test("discovery ranks on all-time signals, not a seven-day window", () => {
  // A weekly window said almost nothing while most products were days old, and it
  // reshuffled the board nightly. The weekly figures stay in the card data, unranked.
  assert.match(productData, /today: `vote_count DESC, total_clicks DESC/);
  assert.match(productData, /trending: `vote_count DESC, total_clicks DESC/);
  assert.doesNotMatch(productData, /trending: `weekly_votes/);
  assert.match(productData, /weeklyVotes: Number\(row\.weekly_votes\)/);
  assert.match(productData, /weeklyClicks: Number\(row\.weekly_clicks\)/);
});

test("one address block cannot stack upvotes on a single product", () => {
  // 64 upvotes arrived on a product with 9 outbound clicks. The voter identity is a
  // cookie the sender controls, so clearing it minted a fresh voter every time.
  assert.match(voteRoute, /const VOTES_PER_PRODUCT_PER_NETWORK = 3;/);
  assert.match(voteRoute, /WHERE product_id = \$1::uuid AND active AND network_hash = \$2 AND voter_hash <> \$3/);
  assert.match(voteRoute, /return \{ stuffed: true as const \}/);
});

test("the vote abuse bucket ignores the caller-supplied user agent", () => {
  // `networkHash` mixed in the full UA string, so editing one character of it opened a
  // fresh rate-limit bucket. The address block is the part a sender cannot rewrite.
  assert.match(voteRoute, /networkBlockHash\(request, "vote"\)/);
  assert.doesNotMatch(voteRoute, /networkHash\(request, "vote"\)/);
  assert.match(requestSecurity, /export function networkBlockHash/);
  assert.match(requestSecurity, /eventHash\(`\$\{context\}:network-block`, truncatedNetwork\(request\)\)/);
});

test("a first-time voter still counts immediately, without a reload", () => {
  // The cookie is issued in the same response, so a new visitor or a founder voting on
  // someone else's product never sees a retry prompt. Cookie-less callers, which mint a
  // fresh identity per request and so escape the per-visitor limit, get their own bucket.
  assert.match(voteRoute, /!visitor\.isNew \|\| await consumeRateLimit/);
  assert.match(voteRoute, /action: "vote:new-visitor", keyHash: abuseHash, limit: 3, windowSeconds: 3600/);
  assert.match(voteRoute, /if \(visitor\.isNew\) response\.cookies\.set\(BIDINDEX_VISITOR_COOKIE/);
});
