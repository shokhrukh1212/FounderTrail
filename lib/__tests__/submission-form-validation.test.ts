import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  logoFileError,
  screenshotFilesError,
  validateSubmissionForm,
} from "../submission-form-validation";

const submissionFormSource = readFileSync(new URL("../../components/SubmissionForm.tsx", import.meta.url), "utf8");

function validForm(): FormData {
  const form = new FormData();
  form.set("websiteUrl", "https://product.example");
  form.set("name", "Example product");
  form.set("tagline", "A concise description of the product.");
  form.set("launchDate", "2026-08-28");
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
  assert.match(errors.launchDate ?? "", /launch date/i);
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
