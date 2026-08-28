import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { brandCopy } from "../brand";

const home = readFileSync(new URL("../../app/page.tsx", import.meta.url), "utf8");
const layout = readFileSync(new URL("../../app/layout.tsx", import.meta.url), "utf8");
const productPage = readFileSync(new URL("../../app/product/[slug]/page.tsx", import.meta.url), "utf8");

test("BidIndex uses the approved discovery positioning", () => {
  assert.equal(brandCopy.metaTitle, "BidIndex — The Home of Bidding Products");
  assert.equal(brandCopy.homepageHeadline, "Discover bidding products actually getting traction.");
  assert.match(home, /Explore products/);
  assert.match(home, /Submit your product — free/);
  assert.doesNotMatch(home, /Live bidding-product discovery|BIDDING-PRODUCT DISCOVERY/i);
});

test("root social metadata uses the current 1200 by 630 JPEG asset", () => {
  assert.equal(existsSync(new URL("../../public/og.jpg", import.meta.url)), true);
  assert.match(layout, /url: "\/og\.jpg"/);
  assert.match(layout, /width: 1200/);
  assert.match(layout, /height: 630/);
  assert.doesNotMatch(layout, /og2\.png|Live bidding-product discovery/i);
});

test("product social metadata uses the BidIndex large-card image and product canonical URL", () => {
  assert.match(productPage, /canonicalProductUrl\(config\.siteUrl, slug\)/);
  assert.match(productPage, /new URL\("\/og\.jpg\?share_version=2"/);
  assert.match(productPage, /card: "summary_large_image"/);
  assert.match(productPage, /width: 1200/);
  assert.match(productPage, /height: 630/);
  assert.doesNotMatch(productPage, /images: product\.logoUrl/);
});
