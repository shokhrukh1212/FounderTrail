import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import { claimSignInUrl, safeReturnTo, signInUrl } from "../return-to";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const claimStart = read("../../app/api/products/[slug]/claims/route.ts");
const claimVerify = read("../../app/api/claims/[claimId]/verify/route.ts");
const claimLegacy = read("../../app/api/products/[slug]/claims/legacy/route.ts");
const claimReview = read("../../app/api/admin/claims/[claimId]/route.ts");
const community = read("../product-community.ts");
const claimUi = read("../../components/ProductClaim.tsx");
const observability = read("../observability.ts");

/**
 * The bug that made every claim fail: PostgreSQL cannot infer a type for a bound
 * parameter passed to the variadic "any" signature of jsonb_build_object, so the whole
 * statement is rejected at parse time with 42P18 and the route falls through to a
 * generic 500. This walks the real source and fails if an uncast parameter comes back.
 */
test("no jsonb_build_object call passes an uncast bound parameter", () => {
  const root = new URL("../../", import.meta.url);
  const walk = (directory: URL): string[] => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, directory);
    if (entry.isDirectory()) return walk(target);
    return /\.tsx?$/.test(entry.name) ? [decodeURIComponent(target.pathname.slice(root.pathname.length))] : [];
  });
  const files = ["app/", "lib/", "scripts/"].flatMap((directory) => walk(new URL(directory, root)));

  const offenders: string[] = [];
  for (const file of files) {
    if (file.includes("__tests__") || file.endsWith("scripts/diagnose-claim.ts")) continue;
    const source = readFileSync(new URL(`../../${file}`, import.meta.url), "utf8");
    let from = 0;
    for (;;) {
      const start = source.indexOf("jsonb_build_object(", from);
      if (start === -1) break;
      let depth = 0;
      let end = start + "jsonb_build_object".length;
      for (; end < source.length; end++) {
        if (source[end] === "(") depth++;
        else if (source[end] === ")" && --depth === 0) break;
      }
      const span = source.slice(start, end + 1);
      from = end + 1;
      const uncast = [...span.matchAll(/\$(\d+)(::)?/g)].filter((match) => !match[2]);
      if (uncast.length) offenders.push(`${file}: $${uncast.map((match) => match[1]).join(",$")}`);
    }
  }
  assert.deepEqual(offenders, [], `uncast parameters would be rejected with 42P18:\n${offenders.join("\n")}`);
});

test("returnTo only ever points back into this site", () => {
  assert.equal(safeReturnTo("/product/example#claim"), "/product/example#claim");
  assert.equal(safeReturnTo("//evil.example/steal"), "/");
  assert.equal(safeReturnTo("https://evil.example"), "/");
  assert.equal(safeReturnTo("/\\evil.example"), "/");
  assert.equal(safeReturnTo(""), "/");
  assert.equal(safeReturnTo(null), "/");
  assert.equal(signInUrl("//evil.example"), "/sign-in?returnTo=%2F");
  assert.equal(claimSignInUrl("my-startup"), "/sign-in?returnTo=%2Fproduct%2Fmy-startup%23claim");
});

test("a claim can still be started when domain proof is unavailable", () => {
  // Asking for manual review, or a listing with no domain to prove, must still produce a
  // pending claim the administrator can see rather than a dead end.
  assert.match(claimStart, /method === "manual_review"/);
  assert.match(claimStart, /asked === "manual_review" \|\| !product\.normalized_domain/);
  assert.match(claimStart, /manual \? "manual_admin" : "domain_file"/);
  assert.match(claimStart, /const challengeHash = manual \? null : tokenHash/);
  assert.match(claimUi, /request manual review/i);
});

test("starting a claim preserves evidence already recorded on it", () => {
  // The submission flow writes evidence.source; a later claim must merge, not overwrite.
  assert.match(claimStart, /evidence=evidence \|\| \$\{evidence\}/);
  assert.doesNotMatch(claimStart, /SET[^`]*evidence=jsonb_build_object/);
});

test("one pending claim per product stays the database's job", () => {
  assert.match(claimStart, /state='pending' FOR UPDATE/);
  assert.match(claimStart, /requester_id !== user\.id\) throw new Error\("CLAIM_PENDING"\)/);
});

test("claim failures report a reference instead of being swallowed", () => {
  for (const [name, source] of [["start", claimStart], ["verify", claimVerify], ["legacy", claimLegacy], ["review", claimReview]] as const) {
    assert.match(source, /reportServerError\(/, `${name} route must record the fault`);
    assert.match(source, /faultBody\(/, `${name} route must return a reference`);
  }
  // The old code logged only error.message and returned a bare string.
  assert.doesNotMatch(claimStart, /console\.error\("claim creation failed"/);
});

test("production logs omit the PostgreSQL detail line and the stack", () => {
  // `detail` echoes the offending row values, which can include a person's email.
  assert.match(observability, /if \(development && fields\.detail\)/);
    assert.match(observability, /if \(development && error instanceof Error && error\.stack\)/);
});

test("a disputed claim is reported to the product page", () => {
  // ProductClaim renders a dedicated "Manual review pending" branch for this state, which
  // was unreachable because the query never emitted it.
  assert.match(community, /THEN 'disputed'/);
  assert.match(community, /ownershipState: "claimed" \| "pending" \| "disputed" \| "unclaimed"/);
  assert.match(claimUi, /state === "disputed"/);
});

test("the claim UI always releases its button and always says something", () => {
  assert.match(claimUi, /async function readJson/);
  assert.match(claimUi, /} finally \{\s*setBusy\(false\);/);
  assert.match(claimUi, /Could not reach FounderTrail/);
  assert.match(claimUi, /Reference: \$\{correlationId\}/);
});

test("founder revenue metrics are retired from both private and public surfaces", () => {
  const config = read("../config.ts");
  const dashboard = read("../../components/OwnerDashboard.tsx");
  const metricsPage = read("../../app/manage/[slug]/metrics/page.tsx");
  const metricsRoute = read("../../app/api/owner/products/[slug]/metrics/stripe/route.ts");

  assert.match(config, /founderMetricsEnabled: false/);
  assert.match(metricsPage, /redirect\(`\/manage\/\$\{slug\}\?tab=verification`\)/);
  assert.equal((metricsRoute.match(/status: 410/g) ?? []).length, 1);
  assert.match(metricsRoute, /export const GET = retired/);
  assert.match(metricsRoute, /export const DELETE = retired/);
  assert.doesNotMatch(dashboard, /\/metrics`\}>Metrics</);
  assert.match(read("../../.env.example"), /FOUNDER_METRICS_ENABLED=false/);
});
