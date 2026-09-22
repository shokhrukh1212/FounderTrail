import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { OWNER_TABS, isOwnerTab, ownerTabHref } from "../owner-tabs";
import { FREE_PLAN_FEATURES, PRO_PLAN_FEATURES, introPriceLine } from "../plan-features";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const dashboard = read("../../components/OwnerDashboard.tsx");
const managePage = read("../../app/manage/[slug]/page.tsx");
const oldLaunchKit = read("../../app/manage/[slug]/launch-kit/page.tsx");
const oldResults = read("../../app/manage/[slug]/results/page.tsx");
const ownerRoute = read("../../app/api/owner/products/[slug]/route.ts");
const studio = read("../../components/LaunchStudio.tsx");
const graphic = read("../launch-graphic.ts");
const launchKitPanel = read("../../components/LaunchKitPanel.tsx");
const mediaRoute = read("../../app/api/owner/products/[slug]/launch-kit/media/[mediaId]/route.ts");
const pricing = read("../../app/pricing/page.tsx");
const checkout = read("../../components/ProCheckout.tsx");
const css = read("../../app/globals.css");

test("the owner workspace has one row of six tabs, each a real URL", () => {
  assert.deepEqual(OWNER_TABS.map((tab) => tab.id), ["overview", "updates", "verification", "settings", "launch-kit", "results"]);
  assert.equal(ownerTabHref("acme", "overview"), "/manage/acme");
  assert.equal(ownerTabHref("acme", "launch-kit"), "/manage/acme?tab=launch-kit");
  assert.equal(isOwnerTab("results"), true);
  assert.equal(isOwnerTab("product"), false);
  // The old second row of tabs and its duplicate "Manage product" jump link are gone.
  assert.doesNotMatch(dashboard, /className="owner-tabs"/);
  assert.doesNotMatch(dashboard, /Manage product/);
  assert.doesNotMatch(dashboard, /role="tab"/);
  // The active tab is marked from the URL, not from client state that a link can't reach.
  assert.match(dashboard, /aria-current=\{tab === item\.id \? "page" : undefined\}/);
  assert.match(managePage, /isOwnerTab\(queryParams\.tab\)/);
});

test("launch kit and results render inside the workspace; old URLs redirect to the tabs", () => {
  assert.match(managePage, /<LaunchKitPanel /);
  assert.match(managePage, /<ProResultsPanel /);
  assert.match(oldLaunchKit, /redirect\(`\/manage\/\$\{encodeURIComponent\(slug\)\}\?tab=launch-kit`\)/);
  assert.match(oldResults, /redirect\(`\/manage\/\$\{encodeURIComponent\(slug\)\}\?tab=results`\)/);
  // Tab definitions live outside the client component so the server can read them.
  assert.doesNotMatch(dashboard, /export const OWNER_TABS/);
});

test("the live banner keeps one row of actions and no duplicate destinations", () => {
  assert.match(dashboard, /owner-live-actions is-single-row/);
  assert.doesNotMatch(dashboard, /Open launch kit/);
  assert.match(css, /\.owner-live-actions\.is-single-row\{[^}]*flex-wrap:nowrap/);
});

test("saving the listing never changes email consent", () => {
  // Only the Settings tab's explicit action touches the founder-news preference.
  const settingsAt = ownerRoute.indexOf('body?.action === "update_settings"');
  const preferenceCalls = ownerRoute.split("updateOwnerMarketingPreference(").length - 1;
  assert.ok(settingsAt > 0);
  assert.equal(preferenceCalls, 1);
  assert.ok(ownerRoute.indexOf("updateOwnerMarketingPreference(") > settingsAt);
  assert.doesNotMatch(dashboard.slice(dashboard.indexOf("<h2>Product information</h2>"), dashboard.indexOf("<h2>Logo and screenshots</h2>")), /marketingOptIn/);
});

test("a missing image leaves that image out instead of blanking the launch graphic", () => {
  assert.match(studio, /async function loadOptionalImage/);
  assert.doesNotMatch(studio, /An image could not be loaded/);
  // Over-long text is clipped with an ellipsis and reported; it never aborts the drawing.
  assert.match(graphic, /clamp\(lines: string\[\]/);
  assert.match(graphic, /layout\.issue/);
  // Words paint first; stored images fill in when they arrive, fetched once per session.
  assert.match(studio, /const early = await paintLaunchGraphic\(target, draft\.image, \{ logo: null, screenshot: null/);
  assert.match(studio, /imageRequests/);
  // The approved listing image falls back to its public copy when storage is not readable.
  assert.match(mediaRoute, /fetchPinnedPublic\(publicUrl/);
  // New drafts start from the short brand name; saved drafts keep what the founder saved.
  assert.match(launchKitPanel, /name: displayProductName\(product\.name, product\.short_name\)/);
});

test("without Pro the studio is visible, locked, and offers the upgrade in place", () => {
  assert.match(studio, /!canEdit && upgradeHref \? <a className="button button-primary" href=\{upgradeHref\}>Upgrade to Pro<\/a>/);
  assert.match(studio, /disabled=\{!canEdit \|\| downloading/);
  assert.match(studio, /onClick=\{resetAll\} disabled=\{!canEdit\}/);
  assert.match(studio, /<fieldset disabled=\{!canEdit\}>/);
  assert.match(studio, /renderError && canEdit \?/);
  // The preview's sticky scope ends before the social drafts.
  assert.match(studio, /<div className="launch-workspace">/);
  assert.match(css, /\.launch-workspace\{display:grid/);
  assert.match(css, /\.button:disabled,\.button\[aria-disabled=true\]\{opacity:\.5/);
});

test("the upgrade page describes Pro exactly as the pricing page does", () => {
  assert.equal(PRO_PLAN_FEATURES.length, 4);
  assert.equal(FREE_PLAN_FEATURES.length, 5);
  assert.match(pricing, /features=\{PRO_PLAN_FEATURES\}/);
  assert.match(checkout, /features=\{PRO_PLAN_FEATURES\}/);
  assert.match(pricing, /introPriceLine\(availability\.available\)/);
  assert.match(checkout, /introPriceLine\(introAvailable\)/);
  assert.equal(introPriceLine(3), "First 20 startup purchases: $5. Then $9.");
  assert.equal(introPriceLine(0), "The $5 introductory offer has ended.");
  assert.match(css, /\.plan-feature-icon\.is-pro/);
});

test("select arrows have room on the right everywhere, and empty-state buttons stay legible", () => {
  assert.match(css, /select:not\(\[multiple\]\):not\(\[size\]\)\{[^}]*padding-right:40px!important/);
  assert.match(css, /background-position:right 14px center!important/);
  assert.match(css, /\.empty-state a:not\(\.button\) \{ color: var\(--accent\)/);
  assert.doesNotMatch(css, /\.empty-state a \{ color: var\(--accent\)/);
});
