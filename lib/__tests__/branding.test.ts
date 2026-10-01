import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { brand, brandCopy } from "../brand";
import { siteSocialImage } from "../seo";

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
  assert.match(home,/Launch your startup — free/);
  assert.match(header,/>Discover</);
  assert.match(header,/>Updates</);
  assert.doesNotMatch(header,/Search products/);
  assert.doesNotMatch(header,/Bid live|Leaderboards/);
});

test("root and product social metadata use 1200 by 630 previews",()=>{
  assert.deepEqual({url:siteSocialImage.url,type:siteSocialImage.type,width:siteSocialImage.width,height:siteSocialImage.height},
    {url:"/brand/og.png",type:"image/png",width:1200,height:630});
  assert.match(layout,/openGraph: siteOpenGraph/);
  assert.match(productPage,/canonicalProductUrl\(config\.siteUrl, slug\)/);
  assert.match(productPage,/const image = productShareImageUrl\(config\.siteUrl, slug\)/);
  assert.match(productPage,/card: "summary_large_image"/);
});

test("active platform copy describes launches, updates, ownership, and Pro honestly",()=>{
  assert.match(about,/How launch weeks work/);
  assert.match(about,/Pro is a one-time launch-tools purchase/);
  assert.match(about,/does not sell placement in this release/);
  assert.doesNotMatch(about,/accepts bidding-related products/);
});
