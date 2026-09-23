import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  logoFileError,
  screenshotFilesError,
  SUBMISSION_FIELDS,
  SUBMISSION_STEPS,
  validateSubmissionForm,
  validateSubmissionStep,
} from "../submission-form-validation";

const submissionFormSource = readFileSync(new URL("../../components/SubmissionForm.tsx", import.meta.url), "utf8");

function validForm(): FormData {
  const form = new FormData();
  form.set("websiteUrl", "https://product.example");
  form.set("name", "Example product");
  form.set("tagline", "A concise description of the product.");
  form.set("categories", "developer-tools");
  form.set("contactEmail", "founder@example.com");
  form.set("ownershipConsent", "on");
  return form;
}

test("valid submission details have no client field errors", () => {
  assert.deepEqual(validateSubmissionForm(validForm()), {});
});

test("required submission errors are attached to their exact fields", () => {
  const errors = validateSubmissionForm(new FormData());
  assert.match(errors.websiteUrl ?? "", /website/i);
  assert.match(errors.name ?? "", /product name/i);
  assert.match(errors.tagline ?? "", /one-line description/i);
  assert.match(errors.categories ?? "", /category/i);
  assert.match(errors.contactEmail ?? "", /contact email/i);
  assert.match(errors.ownershipConsent ?? "", /authorized/i);
});

test("optional founder handle is validated without making it required", () => {
  const optional = validForm();
  assert.equal(validateSubmissionForm(optional).founderSocialHandle, undefined);
  optional.set("founderSocialHandle", "not a valid handle!");
  assert.match(validateSubmissionForm(optional).founderSocialHandle ?? "", /X handle/i);
});

test("logo and screenshot uploads report useful type, size, and count errors", () => {
  assert.match(logoFileError(new File(["plain text"], "logo.txt", { type: "text/plain" })) ?? "", /PNG, JPEG or WebP/);
  assert.match(logoFileError(new File([new Uint8Array(2 * 1024 * 1024 + 1)], "logo.png", { type: "image/png" })) ?? "", /2 MB/);
  const screenshots = Array.from({ length: 5 }, (_, index) => new File(["image"], `${index}.png`, { type: "image/png" }));
  assert.equal(screenshotFilesError(screenshots), "Choose up to four screenshots.");
});

test("submission UI renders inline accessible errors and focuses the first invalid field", () => {
  assert.match(submissionFormSource, /noValidate/);
  assert.match(submissionFormSource, /aria-invalid/);
  assert.match(submissionFormSource, /aria-describedby/);
  assert.match(submissionFormSource, /className="field-error" role="alert"/);
  assert.match(submissionFormSource, /focusField\(firstInvalid\)/);
  assert.match(submissionFormSource, /isSubmissionField\(result\.field\)/);
});

test("pricing stays optional, and each step validates only its own fields", () => {
  // No pricing at all is a complete submission: the public row is simply omitted.
  assert.equal(validateSubmissionForm(validForm()).pricingModel, undefined);
  const amountWithoutModel = validForm();
  amountWithoutModel.set("startingPrice", "9");
  assert.match(validateSubmissionForm(amountWithoutModel).pricingModel ?? "", /pricing model/i);
  const amountWithoutBasis = validForm();
  amountWithoutBasis.set("pricingModel", "paid");
  amountWithoutBasis.set("startingPrice", "29");
  amountWithoutBasis.set("pricingCurrency", "USD");
  assert.match(validateSubmissionForm(amountWithoutBasis).pricingBasis ?? "", /one-time, monthly/i);

  // Step 1 only owns the website, so an empty name must not block leaving it.
  const website = new FormData();
  website.set("websiteUrl", "https://product.example");
  assert.deepEqual(validateSubmissionStep(website, 1), {});
  assert.deepEqual(validateSubmissionStep(website, 2), {
    name: "Enter a product name using 80 characters or fewer.",
    tagline: "Add a one-line description using 160 characters or fewer.",
    categories: "Choose at least one category.",
  });
  // A saved draft is allowed to be incomplete.
  assert.equal(validateSubmissionStep(website, 2, { draft: true }).categories, undefined);

  // Every field belongs to exactly one step.
  const owned = [...SUBMISSION_STEPS[1], ...SUBMISSION_STEPS[2], ...SUBMISSION_STEPS[3]];
  assert.deepEqual([...owned].sort(), [...SUBMISSION_FIELDS].sort());
  assert.equal(new Set(owned).size, owned.length);
});

test("the three-step form keeps every field in the submitted payload", () => {
  // Inactive steps are hidden, never unmounted: an unmounted input is absent from
  // FormData, which would silently drop whatever the founder already typed.
  assert.match(submissionFormSource, /fieldset hidden=\{step !== 1\}/);
  assert.match(submissionFormSource, /fieldset hidden=\{step !== 2\}/);
  assert.match(submissionFormSource, /fieldset hidden=\{step !== 3\}/);
  assert.doesNotMatch(submissionFormSource, /step === 2 \?\s*</);
  assert.match(readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8"), /\.submission-form fieldset\[hidden\]\{display:none\}/);
});

test("a fetch never overwrites a field the founder already edited", () => {
  assert.match(submissionFormSource, /edited\.current\.add\("name"\)/);
  assert.match(submissionFormSource, /edited\.current\.add\("tagline"\)/);
  assert.match(submissionFormSource, /if \(!edited\.current\.has\("name"\)\) setName/);
  assert.match(submissionFormSource, /if \(!edited\.current\.has\("tagline"\)\) setTagline/);
});

test("a duplicate domain is caught at step 1 and the shared-domain option only appears then", () => {
  assert.match(submissionFormSource, /if \(result\.duplicate\)/);
  assert.match(submissionFormSource, /duplicate \? <div className="duplicate-notice"/);
  // The confusing checkbox must live inside the duplicate branch, not the default form.
  const notice = submissionFormSource.slice(submissionFormSource.indexOf('duplicate-notice'));
  const noticeEnd = notice.indexOf("</div> : null}");
  assert.ok(notice.slice(0, noticeEnd).includes('name="distinctProduct"'), "distinctProduct belongs in the duplicate branch");
  assert.equal(submissionFormSource.split('name="distinctProduct"').length - 1, 1);
});

test("screenshots collect accessible alt text that reaches the database", () => {
  assert.match(submissionFormSource, /data\.append\("screenshotAlt"/);
  const productsRoute = readFileSync(new URL("../../app/api/products/route.ts", import.meta.url), "utf8");
  assert.match(productsRoute, /form\.getAll\("screenshotAlt"\)/);
  assert.match(productsRoute, /position, alt_text/);
  assert.match(productsRoute, /slice\(0, 240\)/); // the column caps alt_text at 240 characters
});

test("the duplicate-domain rule has exactly one implementation", () => {
  const productsRoute = readFileSync(new URL("../../app/api/products/route.ts", import.meta.url), "utf8");
  const metadataRoute = readFileSync(new URL("../../app/api/products/metadata/route.ts", import.meta.url), "utf8");
  assert.match(productsRoute, /findDomainDuplicate\(/);
  assert.match(metadataRoute, /findDomainDuplicate\(/);
  // Neither route may re-query the rule itself.
  assert.doesNotMatch(productsRoute, /normalized_domain=\$1 AND status IN/);
  assert.doesNotMatch(metadataRoute, /normalized_domain=\$1 AND status IN/);
});

test("only a published duplicate is named", () => {
  const helper = readFileSync(new URL("../duplicate-domain.ts", import.meta.url), "utf8");
  assert.match(helper, /kind: "own_draft", slug: null, name: null/);
  assert.match(helper, /kind: "under_review", slug: null, name: null/);
  assert.match(helper, /kind: "published", slug: duplicate\.slug, name: duplicate\.name/);
});

test("the founder's contact email is prefilled but still described as private", () => {
  assert.match(submissionFormSource, /defaultValue=\{accountEmail\}/);
  assert.match(submissionFormSource, /defaultValue=\{accountName\}/);
  assert.match(submissionFormSource, /Never displayed publicly/);
  // Founder updates are on by default in their own box, separate from the attestation;
  // unticking it is the founder's choice and is never required.
  const marketing = submissionFormSource.match(/name="marketingOptIn"[^>]*>/)?.[0] ?? "";
  assert.match(marketing, /defaultChecked/);
  assert.doesNotMatch(marketing, /required/);
});

test("a duplicate keeps the founder on step 1 without losing what was fetched", () => {
  // The shared-domain checkbox lives inside the duplicate notice; dismissing the notice
  // would unmount it and silently drop distinctProduct from the payload.
  assert.doesNotMatch(submissionFormSource, /setDuplicate\(null\); setStep\(2\)/);
  assert.match(submissionFormSource, /onClick=\{\(\) => setStep\(2\)\}>Continue anyway/);
  // The metadata is applied before the duplicate branch returns, so "Continue anyway"
  // still has the prefilled name, tagline and signed token.
  const applyAt = submissionFormSource.indexOf("setMetadataToken(result.token");
  const duplicateAt = submissionFormSource.indexOf("if (result.duplicate)");
  assert.ok(applyAt > 0 && duplicateAt > applyAt, "metadata must be applied before the duplicate branch");
  // Leaving step 1 by hand still validates the website URL.
  assert.match(submissionFormSource, /setFetched\(true\); goToStep\(2\);/);
});
