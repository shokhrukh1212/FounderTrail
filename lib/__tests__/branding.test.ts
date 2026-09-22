import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { brand, brandCopy } from "../brand";

const read=(path:string)=>readFileSync(new URL(path,import.meta.url),"utf8");
const home=read("../../app/page.tsx");
const layout=read("../../app/layout.tsx");
const productPage=read("../../app/product/[slug]/page.tsx");
const header=read("../../components/SiteHeader.tsx");
const about=read("../../app/about/page.tsx");

test("FounderTrail uses the approved discovery positioning",()=>{
  assert.equal(brand.displayName,"FounderTrail");
  assert.equal(brandCopy.metaTitle,"FounderTrail — Launch startups and find supporters");
  assert.equal(brandCopy.homepageHeadline,"Launch your startup. Find your first supporters.");
  assert.match(home,/Explore startups ranked by community upvotes/);
  assert.match(home,/Submit your startup — free/);
  assert.match(header,/>Discover</);
  assert.match(header,/>Updates</);
  assert.doesNotMatch(header,/Search products/);
  assert.doesNotMatch(header,/Bid live|Leaderboards/);
});

test("root and product social metadata use generated 1200 by 630 previews",()=>{
  assert.match(layout,/url: "\/opengraph-image"/);
  assert.match(layout,/type: "image\/png"/);
  assert.match(layout,/width: 1200/);
  assert.match(layout,/height: 630/);
  assert.match(productPage,/canonicalProductUrl\(config\.siteUrl, slug\)/);
  assert.match(productPage,/\/product\/\$\{encodeURIComponent\(slug\)\}\/opengraph-image/);
  assert.match(productPage,/card: "summary_large_image"/);
});

test("active platform copy describes launches, updates, ownership, and sponsorship honestly",()=>{
  assert.match(about,/How launch weeks work/);
  assert.match(about,/processed by Dodo Payments/);
  assert.match(about,/Paid sponsorship never bypasses review/);
  assert.doesNotMatch(about,/accepts bidding-related products/);
});
