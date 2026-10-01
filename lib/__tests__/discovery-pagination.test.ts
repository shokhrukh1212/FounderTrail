import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read=(path:string)=>readFileSync(new URL(path,import.meta.url),"utf8");
const homepage=read("../../app/page.tsx");
const data=read("../foundertrail-data.ts");
const row=read("../../components/StartupRow.tsx");
const launchVote=read("../../app/api/launches/[launchId]/vote/route.ts");
const migration=read("../../migrations/011_foundertrail_core.up.sql");

test("discovery exposes the three product views and stable pagination",()=>{
  assert.match(homepage,/id:\s*"this_week",\s*label:\s*"This week"/);
  assert.match(homepage,/id:\s*"discover",\s*label:\s*"All startups"/);
  assert.match(homepage,/id:\s*"updates",\s*label:\s*"Updates"/);
  assert.match(data,/const pageSize = 24/);
  assert.match(data,/count\(\*\)::int AS total/);
  assert.match(data,/LIMIT \$\$\{params\.length - 1\} OFFSET \$\$\{params\.length\}/);
  assert.match(homepage,/Page \{page\} of/);
});

test("an empty launch week visibly falls back to the existing directory",()=>{
  assert.match(homepage,/No launches this week yet/);
  assert.match(homepage,/Community favourites/);
  assert.match(homepage,/Launch your startup/);
  assert.match(homepage,/Browse and filter all/);
});

test("weekly launch order is isolated from legacy support and paid placement",()=>{
  assert.match(data,/launch_votes DESC,pl\.starts_at,p\.id/);
  assert.match(data,/JOIN product_launches/);
  assert.match(data,/all_time_upvotes/);
  assert.match(launchVote,/status: 410/);
  assert.match(migration,/PRIMARY KEY\(launch_id, user_id\)/);
  assert.match(migration,/UNIQUE\(product_id\)/);
});

test("startup rows carry one internal destination and the three community actions",()=>{
  // Logo and name link to the product page; the row itself is not one big anchor.
  assert.match(row,/const productHref = `\/product\/\$\{product\.slug\}`/);
  assert.match(row,/VoteButton/);
  assert.match(row,/CommentsLink/);
  assert.match(row,/FollowButton/);
  assert.match(row,/categoryFilterHref/);
  // Visit website, outbound-click counts and pricing pills belong to the detail page.
  assert.doesNotMatch(row,/\/go\//);
  assert.doesNotMatch(row,/outbound click/);
  assert.doesNotMatch(row,/pricing/i);
  assert.doesNotMatch(row,/See website/);
});
