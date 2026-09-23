import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const form = read("../../components/SubmissionForm.tsx");
const offer = read("../../components/SubmissionProOffer.tsx");
const checkout = read("../../app/api/owner/products/[slug]/pro/checkout/route.ts");
const pro = read("../pro-launch.ts");
const moderation = read("../../app/api/admin/products/[slug]/status/route.ts");
const migration = read("../../migrations/018_inline_pro_submission.up.sql");

test("the final submission step keeps Pro explicit and free submission available", () => {
  assert.match(offer, /type="checkbox" checked=\{selected\}/);
  assert.match(form, /Submit & go to checkout/);
  assert.match(form, /Free submission/);
  assert.match(form, /submissionStatus" value="draft"/);
  assert.match(form, /submissionKey/);
});

test("pending checkout trusts the submitter and rejection queues a durable refund", () => {
  assert.match(pro, /p\.status='pending'.*p\.created_by_user_id=\$2/s);
  assert.match(pro, /NOT EXISTS\(SELECT 1 FROM product_moderation_events/);
  assert.match(moderation, /queueRejectedProRefunds/);
  assert.match(pro, /rejection_refund_required/);
  assert.doesNotMatch(checkout, /activatePurchasedPro/);
});

test("the migration is additive and records replay, attribution, and refund state", () => {
  assert.doesNotMatch(migration, /DROP|TRUNCATE|DELETE FROM/i);
  for (const column of ["submission_key", "submission_pro_selected", "entry_point", "purchased_before_approval", "rejection_refund_required"]) {
    assert.match(migration, new RegExp(column));
  }
});
