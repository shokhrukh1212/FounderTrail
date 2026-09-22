import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  FOUNDERTRAIL_CATEGORIES,
  categoryFilterHref,
  normalizeCategorySelection,
  toggleCategorySelection,
} from "../categories";
import { decodeEntities, displayProductName, nameNeedsReview, publicText, suggestedShortName } from "../display-text";
import { parsePricingInput, publicPricingLabel } from "../product-pricing";
import { canonicalProductUrl, productShareText, publicShareOrigin, xProductShareIntent } from "../product-share";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const migration = read("../../migrations/017_content_ui_followup.up.sql");
const migrationDown = read("../../migrations/017_content_ui_followup.down.sql");
const restore = read("../../scripts/restore-product-categories.ts");
const enrich = read("../../scripts/enrich-foundertrail-metadata.ts");
const row = read("../../components/StartupRow.tsx");
const commentsLink = read("../../components/CommentsLink.tsx");
const discovery = read("../foundertrail-data.ts");
const community = read("../product-community.ts");
const productPage = read("../../app/product/[slug]/page.tsx");
const shareRoute = read("../../app/share/x/[slug]/route.ts");
const picker = read("../../components/CategoryPicker.tsx");
const adminDetails = read("../../app/api/admin/products/[slug]/details/route.ts");
const css = read("../../app/globals.css");

test("the taxonomy is the fixed FounderTrail list, with stable slugs", () => {
  assert.equal(FOUNDERTRAIL_CATEGORIES.length, 24);
  const slugs: string[] = FOUNDERTRAIL_CATEGORIES.map((category) => category.slug);
  assert.equal(new Set(slugs).size, slugs.length);
  assert.ok(slugs.includes("ai-assistants") && slugs.includes("marketplaces-directories") && slugs.includes("other"));
  // SaaS, Free, Paid and Open source are characteristics or prices, never categories.
  for (const banned of ["saas", "free", "paid", "open-source"]) assert.ok(!slugs.includes(banned), banned);
  // Every category the form offers exists in the migration that seeds them.
  for (const category of FOUNDERTRAIL_CATEGORIES) {
    assert.ok(migration.includes(`('${category.slug}','${category.name.replace(/'/g, "''")}')`), category.slug);
  }
});

test("a product carries one to three categories and Other is exclusive", () => {
  assert.deepEqual(normalizeCategorySelection("developer-tools,ai-assistants"), { ok: true, slugs: ["developer-tools", "ai-assistants"] });
  assert.equal(normalizeCategorySelection("").ok, false);
  assert.deepEqual(normalizeCategorySelection("", { allowEmpty: true }), { ok: true, slugs: [] });
  assert.equal(normalizeCategorySelection("a,b,c,d").ok, false);
  assert.equal(normalizeCategorySelection("developer-tools,ai-assistants,productivity,other").ok, false);
  assert.equal(normalizeCategorySelection("other,productivity").ok, false);
  assert.equal(normalizeCategorySelection("not-a-category").ok, false);
  // Duplicates collapse instead of eating one of the three slots.
  assert.deepEqual(normalizeCategorySelection(["productivity", "productivity"]), { ok: true, slugs: ["productivity"] });

  assert.deepEqual(toggleCategorySelection(["productivity"], "other"), ["other"]);
  assert.deepEqual(toggleCategorySelection(["other"], "productivity"), ["productivity"]);
  const full = ["productivity", "ai-assistants", "developer-tools"];
  assert.deepEqual(toggleCategorySelection(full, "marketing-seo"), full);
  assert.deepEqual(toggleCategorySelection(full, "productivity"), ["ai-assistants", "developer-tools"]);
});

test("the category picker states the limit, the count and Other's exclusivity", () => {
  assert.match(picker, /Choose up to \{MAX_PRODUCT_CATEGORIES\} categories/);
  assert.match(picker, /selected\.length\} of \{MAX_PRODUCT_CATEGORIES\} selected/);
  assert.match(picker, /aria-live="polite"/);
  assert.match(picker, /Remove \$\{categoryName\(slug\)/);
  assert.match(picker, /type="search"/);
});

test("the one-time category reset archives first and can never fire twice", () => {
  // Archive, then reset the fixed target set, then record completion.
  const archiveAt = migration.indexOf("INSERT INTO product_category_archive");
  const resetAt = migration.indexOf("UPDATE products p\n     SET primary_category_id=other_id");
  const recordAt = migration.indexOf("INSERT INTO category_migration_runs");
  assert.ok(archiveAt > 0 && resetAt > archiveAt && recordAt > resetAt, "archive -> reset -> record");
  assert.match(migration, /IF EXISTS \(SELECT 1 FROM category_migration_runs WHERE version=run_version\) THEN[\s\S]*RETURN;/);
  assert.match(migration, /before_counts/);
  assert.match(migration, /after_counts/);
  assert.match(migration, /target_product_count/);
  // The reset only ever touches rows it archived in this run, never later submissions.
  assert.match(migration, /FROM product_category_archive a\n   WHERE a\.version=run_version AND a\.product_id=p\.id/);
  assert.doesNotMatch(migration, /DELETE FROM products/);
  assert.match(migration, /category_review_required=true/);
});

test("recovery restores only products nobody has classified since the reset", () => {
  assert.match(restore, /p\.category_provenance=\$1/);
  assert.match(restore, /skippedBecauseEditedSince/);
  assert.match(restore, /--apply/);
  assert.doesNotMatch(restore, /DELETE FROM products\b/);
  // The down migration applies the same rule.
  assert.match(migrationDown, /WHERE a\.version=run_version AND p\.category_provenance=run_version/);
});

test("automated classification cannot overwrite a category or a price", () => {
  assert.doesNotMatch(enrich, /UPDATE products SET primary_category_id/);
  assert.doesNotMatch(enrich, /UPDATE products SET pricing_model/);
  assert.match(enrich, /review_state[\s\S]{0,80}needs_review/);
  assert.match(enrich, /never writes products\.primary_category_id/);
});

test("rows show the community actions and leave website traffic to the detail page", () => {
  assert.match(row, /VoteButton/);
  assert.match(row, /CommentsLink/);
  assert.match(row, /FollowButton/);
  assert.match(row, /ProBadge/);
  assert.match(row, /categoryFilterHref/);
  assert.doesNotMatch(row, /Visit website/);
  assert.doesNotMatch(row, /outboundClicks/);
  assert.doesNotMatch(row, /pricing/i);
  // The detail page keeps its prominent tracked visit action.
  assert.match(productPage, /\/go\/\$\{product\.slug\}\?source=product_page/);
});

test("the name link reserves its arrow so hover and focus never move the row", () => {
  assert.match(row, /startup-name-arrow/);
  assert.match(css, /\.startup-name-arrow\{[^}]*width:14px/);
  assert.match(css, /\.startup-name-link:hover \.startup-name-arrow,\.startup-name-link:focus-visible \.startup-name-arrow\{opacity:1/);
  // Touch users get the affordance without hovering.
  assert.match(css, /@media\(hover:none\)\{\.startup-name-arrow\{opacity:\.5/);
  // The action column is a fixed width, so every row's actions start on the same line.
  assert.match(css, /\.startup-row\{--row-actions:222px[^}]*grid-template-columns:30px 54px minmax\(0,1fr\) var\(--row-actions\)/);
  assert.match(css, /\.startup-actions\{[^}]*justify-content:flex-start/);
});

test("comment counts are real, exclude hidden posts, and load once per page", () => {
  // The list count and the discussion itself apply the same visibility rule.
  assert.match(discovery, /FROM product_comments pcm WHERE pcm\.product_id=p\.id AND pcm\.hidden_at IS NULL\) AS comment_count/);
  assert.match(community, /FROM product_comments pcm WHERE pcm\.product_id=p\.id AND pcm\.hidden_at IS NULL\) AS comment_count/);
  assert.match(community, /WHERE c\.product_id=\$1::uuid AND c\.hidden_at IS NULL/);
  // One correlated subquery inside the page query, not one round trip per row.
  assert.equal(discovery.split("AS comment_count").length - 1, 1);
  assert.match(migration, /CREATE INDEX IF NOT EXISTS product_comments_visible_idx[\s\S]*WHERE hidden_at IS NULL/);
});

test("the comments control deep links into the discussion and works signed out", () => {
  assert.match(commentsLink, /href=\{`\/product\/\$\{slug\}#discussion`\}/);
  assert.match(commentsLink, /aria-label=/);
  assert.doesNotMatch(commentsLink, /sign-in/);
  // The sticky header is accounted for by the section's own scroll offset.
  assert.match(productPage, /id="discussion" className="detail-section"/);
  assert.match(css, /\.detail-section \{ scroll-margin-top: \d+px;/);
});

test("product-page sharing drafts exactly one sentence and one canonical link", () => {
  assert.equal(productShareText("AgentHill"), "Discover AgentHill on FounderTrail.");
  const intent = xProductShareIntent({ siteUrl: "https://foundertrail.example", slug: "agent hill", shortProductName: "AgentHill" });
  const parsed = new URL(intent);
  assert.equal(parsed.origin + parsed.pathname, "https://x.com/intent/tweet");
  assert.equal(parsed.searchParams.get("text"), "Discover AgentHill on FounderTrail.");
  // The shared link carries the share-card version so X fetches the current card.
  assert.equal(parsed.searchParams.get("url"), "https://foundertrail.example/product/agent%20hill?v=1");
  // The link appears once: in the url parameter, never also inside the text.
  assert.doesNotMatch(parsed.searchParams.get("text") ?? "", /http/);
  assert.equal(canonicalProductUrl("https://foundertrail.example/", "a-b"), "https://foundertrail.example/product/a-b");
  // No slogan, metrics, hashtags, or claims about who is posting.
  for (const forbidden of ["#", "I'm building", "upvote"]) {
    assert.ok(!productShareText("AgentHill").includes(forbidden), forbidden);
  }
  // A localhost site URL is replaced when the platform knows the production hostname.
  process.env.VERCEL_PROJECT_PRODUCTION_URL = "example.vercel.app";
  assert.equal(publicShareOrigin("http://localhost:3000"), "https://example.vercel.app");
  delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
  // The founder's own launch draft is untouched by the product-page draft.
  assert.match(shareRoute, /source==="owner"\|\|source==="email"/);
  assert.match(shareRoute, /xLaunchIntent/);
  assert.match(shareRoute, /xProductShareIntent/);
});

test("public text is decoded safely and short names are never guessed", () => {
  assert.equal(publicText("The internet&#x27;s billboard"), "The internet’s billboard".replace("’", "'"));
  assert.equal(decodeEntities("Ben &amp; Jerry&apos;s"), "Ben & Jerry's");
  assert.equal(decodeEntities("100 &lt; 200"), "100 < 200");
  // Legitimate Unicode and stray ampersands survive.
  assert.equal(decodeEntities("Café — R&D"), "Café — R&D");
  assert.equal(decodeEntities("&notanentity;"), "&notanentity;");
  // Control characters and lone surrogates are dropped rather than corrupting the text.
  assert.equal(decodeEntities("a&#0;b"), "a&#0;b");
  assert.equal(decodeEntities("a&#xD800;b"), "a&#xD800;b");

  // Display falls back to the submitted name until a person sets a short one.
  assert.equal(displayProductName("SaaS Town - A gamified 3D directory for SaaS startups", null), "SaaS Town - A gamified 3D directory for SaaS startups");
  assert.equal(displayProductName("SaaS Town - A gamified 3D directory", "SaaS Town"), "SaaS Town");
  // Suggestions exist for review; they are not applied anywhere automatically.
  assert.equal(suggestedShortName("AgentHill — agents fight the hill"), "AgentHill");
  assert.equal(suggestedShortName("bidmap.lol"), null);
  assert.equal(suggestedShortName("Ben & Jerry's"), null);
  assert.equal(nameNeedsReview("YourHour - Pay less, Get more.", null), true);
  assert.equal(nameNeedsReview("YourHour - Pay less, Get more.", "YourHour"), false);
  assert.equal(nameNeedsReview("BidPixel", null), false);
});

test("pricing is optional, consistent, and never invented", () => {
  assert.equal(publicPricingLabel(null), null);
  assert.equal(publicPricingLabel({ model: null, startingPriceMinor: null, currency: null, basis: null, unit: null, perSeat: false }), null);

  const blank = parsePricingInput({});
  assert.ok(blank.ok && blank.value.model === null);

  const modelOnly = parsePricingInput({ pricingModel: "free" });
  assert.ok(modelOnly.ok);
  assert.equal(publicPricingLabel(modelOnly.ok ? modelOnly.value : null), "Free");
  const contact = parsePricingInput({ pricingModel: "contact" });
  assert.equal(publicPricingLabel(contact.ok ? contact.value : null), "Contact sales");

  const freemium = parsePricingInput({ pricingModel: "freemium", startingPrice: "9", pricingCurrency: "USD", pricingBasis: "monthly" });
  assert.equal(publicPricingLabel(freemium.ok ? freemium.value : null), "Freemium · Paid plans from USD 9/month");
  const paid = parsePricingInput({ pricingModel: "paid", startingPrice: "29", pricingCurrency: "USD", pricingBasis: "one_time" });
  assert.equal(publicPricingLabel(paid.ok ? paid.value : null), "Paid · From USD 29 one-time");
  const seats = parsePricingInput({ pricingModel: "paid", startingPrice: "12.50", pricingCurrency: "EUR", pricingBasis: "monthly", pricingPerSeat: "on" });
  assert.equal(publicPricingLabel(seats.ok ? seats.value : null), "Paid · From EUR 12.50/month per seat");
  const usage = parsePricingInput({ pricingModel: "paid", startingPrice: "5", pricingCurrency: "USD", pricingBasis: "usage_based", pricingUnit: "per 1,000 credits" });
  assert.equal(publicPricingLabel(usage.ok ? usage.value : null), "Paid · From USD 5 per 1,000 credits");

  // Inconsistent or negative entries are rejected, field by field.
  assert.equal(parsePricingInput({ pricingModel: "paid", startingPrice: "29", pricingCurrency: "USD" }).ok, false);
  assert.equal(parsePricingInput({ pricingModel: "paid", startingPrice: "-5", pricingCurrency: "USD", pricingBasis: "monthly" }).ok, false);
  assert.equal(parsePricingInput({ pricingModel: "free", startingPrice: "9" }).ok, false);
  assert.equal(parsePricingInput({ startingPrice: "9" }).ok, false);
  assert.equal(parsePricingInput({ pricingModel: "paid", startingPrice: "5", pricingCurrency: "USD", pricingBasis: "usage_based" }).ok, false);
  assert.equal(parsePricingInput({ pricingModel: "open_source" }).ok, false);

  // Nothing rendered says "Unknown", "Not listed" or "See website" as a price: the row
  // is omitted instead. (The only matches left in the page are explanatory comments.)
  assert.match(productPage, /\{pricing \? <div><dt>Pricing<\/dt>/);
  assert.doesNotMatch(productPage, /<dd>\{pricing \|\|/);
  assert.doesNotMatch(read("../product-community.ts"), /"See website"/);
  // Legacy inferred pricing is archived privately and cleared from the public columns.
  assert.match(migration, /CREATE TABLE product_pricing_legacy/);
  assert.match(migration, /pricing_provenance IS NULL OR pricing_provenance NOT IN \('founder','admin'\)/);
  assert.match(migration, /is_open_source=true WHERE pricing_model='open_source'/);
  assert.match(migration, /products_pricing_amount_check/);
});

test("directory filters match any of a product's categories without duplicating it", () => {
  assert.match(discovery, /EXISTS\(SELECT 1 FROM product_categories fpc JOIN categories fc/);
  assert.doesNotMatch(discovery, /LEFT JOIN categories c ON c\.id=p\.primary_category_id WHERE/);
  assert.match(discovery, /count\(DISTINCT pc\.product_id\)/);
  assert.equal(categoryFilterHref("ai-assistants"), "/?view=discover&category=ai-assistants#products");
});

test("historical totals and the sign-in rules behind them are unchanged", () => {
  // Upvotes, follower counts and outbound clicks keep counting exactly what they did.
  assert.match(discovery, /FROM product_votes pv WHERE pv\.product_id=p\.id AND pv\.active AND \(p\.is_demo OR NOT pv\.is_demo\)\) AS all_time_upvotes/);
  assert.match(community, /FROM product_outbound_click_events oce WHERE oce\.product_id=p\.id AND oce\.outcome='counted'\) AS outbound_clicks/);
  assert.match(discovery, /all_time_upvotes DESC,p\.created_at,p\.id/);
  assert.match(discovery, /launch_votes DESC,pl\.approved_at,p\.id/);
  // Voting, following and posting still require a signed-in account; reading does not.
  assert.match(read("../../components/VoteButton.tsx"), /response\.status === 401/);
  assert.match(read("../../components/FollowButton.tsx"), /response\.status === 401/);
  // The migration adds columns and tables; it never drops product history.
  assert.doesNotMatch(migration, /DROP TABLE|DROP COLUMN|DELETE FROM product_votes|DELETE FROM product_comments/);
});

test("admin correction owns names, categories and pricing without touching the record", () => {
  assert.match(adminDetails, /export async function PATCH/);
  assert.match(adminDetails, /validAdminRequest/);
  assert.match(adminDetails, /requestOriginIsSameSite/);
  assert.match(adminDetails, /applyProductCategories\(client,productId,categories\.slugs,"admin"\)/);
  assert.match(adminDetails, /product\.listing_corrected/);
  // The submitted name, the slug and every community signal stay as they are.
  assert.doesNotMatch(adminDetails, /SET name=|UPDATE products[\s\S]{0,200}\bslug=/);
  const table = read("../../components/AdminProductTable.tsx");
  assert.match(table, /Other \/ needs classification/);
  assert.match(table, /Name needs review/);
  assert.match(table, /suggestedShortName/);
  assert.match(table, /Use this/);
});

test("posting a comment, reply or edit resets its form",()=>{
  const discussion=readFileSync(new URL("../../components/Discussion.tsx",import.meta.url),"utf8");
  assert.match(discussion,/if \(response\.ok\) \{ setBody\(""\); refresh\(\); \}/);
  assert.match(discussion,/if \(response\.ok\) \{ setReply\(""\); setReplying\(false\); onChanged\(\); \}/);
  assert.match(discussion,/if \(response\.ok\) \{ setEditing\(false\); onChanged\(\); \}/);
});

test("website logos reach the launch graphic at their real size and fill the tile when opaque",()=>{
  const mediaRoute=readFileSync(new URL("../../app/api/owner/products/[slug]/launch-kit/media/[mediaId]/route.ts",import.meta.url),"utf8");
  const graphic=readFileSync(new URL("../launch-graphic.ts",import.meta.url),"utf8");
  // Padding a 48px favicon onto a 512px canvas drew it as a dot and hid how small it was.
  assert.match(mediaRoute,/fit: "inside"/);
  assert.doesNotMatch(mediaRoute,/fit: "contain"/);
  assert.match(graphic,/const inset = isFullBleedLogo\(logo\) \? 0 : size \* 0\.1/);
  assert.match(graphic,/Math\.max\(box \/ w, box \/ h\)/);
});

test("every link that goes into a post, and the share image, carry the share-card version",async()=>{
  const share=await import("../product-share");
  const { displayUrl } = await import("../launch-kit");
  assert.equal(share.sharedProductUrl("https://bidindex.dev/","yourhour"),`https://bidindex.dev/product/yourhour?v=${share.SHARE_CARD_VERSION}`);
  assert.equal(share.productShareImageUrl("https://bidindex.dev","yourhour"),`https://bidindex.dev/product/yourhour/opengraph-image?v=${share.SHARE_CARD_VERSION}`);
  assert.equal(new URL(share.productLaunchUrl("https://bidindex.dev","yourhour")).searchParams.get("v"),share.SHARE_CARD_VERSION);
  // Canonical URLs (search engines, emails) stay clean.
  assert.equal(share.canonicalProductUrl("https://bidindex.dev","yourhour"),"https://bidindex.dev/product/yourhour");
  // The launch graphic prints the address without the version or tracking.
  assert.equal(displayUrl("https://bidindex.dev/product/yourhour?v=1&ref=x#top"),"bidindex.dev/product/yourhour");
  const panel=readFileSync(new URL("../../components/LaunchKitPanel.tsx",import.meta.url),"utf8");
  const draftRoute=readFileSync(new URL("../../app/api/owner/products/[slug]/launch-kit/draft/route.ts",import.meta.url),"utf8");
  assert.match(panel,/founderTrailUrl: sharedProductUrl\(config\.siteUrl, slug\)/);
  assert.match(draftRoute,/founderTrailUrl: sharedProductUrl\(config\.siteUrl, row\.slug\)/);
});
