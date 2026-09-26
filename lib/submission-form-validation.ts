import { normalizeCategorySelection } from "./categories";
import { parsePricingInput } from "./product-pricing";
import { parseXHandleInput } from "./x-handle";

export const SUBMISSION_FIELDS = [
  "websiteUrl",
  "name",
  "tagline",
  "categories",
  "pricingModel",
  "startingPrice",
  "pricingCurrency",
  "pricingBasis",
  "pricingUnit",
  "contactEmail",
  "founderSocialHandle",
  "logo",
  "screenshots",
  "ownershipConsent",
] as const;

export type SubmissionField = (typeof SUBMISSION_FIELDS)[number];
export type SubmissionFieldErrors = Partial<Record<SubmissionField, string>>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

/**
 * Which fields each step of the submission flow owns. Advancing a step validates only
 * that step, so a founder is never blocked by a field they have not reached yet.
 */
export const SUBMISSION_STEPS = {
  1: ["websiteUrl"],
  2: ["name", "tagline", "categories", "pricingModel", "startingPrice", "pricingCurrency", "pricingBasis", "pricingUnit", "logo", "screenshots"],
  3: ["contactEmail", "founderSocialHandle", "ownershipConsent"],
} as const satisfies Record<1 | 2 | 3, readonly SubmissionField[]>;

export type SubmissionStep = keyof typeof SUBMISSION_STEPS;

function value(form: FormData, name: string): string {
  const entry = form.get(name);
  return typeof entry === "string" ? entry.trim() : "";
}

export function websiteFieldError(raw: string): string | null {
  const candidate = /^https?:\/\//i.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`;
  try {
    const url = new URL(candidate);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || !url.hostname.includes(".")) throw new Error();
    return null;
  } catch {
    return "Enter a public product website, for example https://example.com.";
  }
}

function imageError(file: File, maxBytes: number, label: string): string | null {
  if (!IMAGE_TYPES.has(file.type)) return `${label} must be a PNG, JPEG or WebP image.`;
  if (file.size <= 0 || file.size > maxBytes) return `${label} must be smaller than ${maxBytes === 2 * 1024 * 1024 ? "2 MB" : "5 MB"}.`;
  return null;
}

export function logoFileError(file: File | null): string | null {
  return file ? imageError(file, 2 * 1024 * 1024, "Logo") : null;
}

export function screenshotFilesError(files: File[]): string | null {
  if (files.length > 4) return "Choose up to four screenshots.";
  for (const file of files) {
    const error = imageError(file, 5 * 1024 * 1024, "Each screenshot");
    if (error) return error;
  }
  return null;
}

/** `draft` relaxes only what a saved-but-unfinished listing is allowed to be missing. */
export function validateSubmissionForm(form: FormData, options: { draft?: boolean } = {}): SubmissionFieldErrors {
  const errors: SubmissionFieldErrors = {};
  const website = value(form, "websiteUrl");
  const websiteError = websiteFieldError(website);
  if (websiteError) errors.websiteUrl = websiteError;

  const name = value(form, "name");
  if (!name || name.length > 80) errors.name = "Enter a product name using 80 characters or fewer.";
  const tagline = value(form, "tagline");
  if (!tagline || tagline.length > 160) errors.tagline = "Add a one-line description using 160 characters or fewer.";

  const categories = normalizeCategorySelection(value(form, "categories"), { allowEmpty: options.draft });
  if (!categories.ok) errors.categories = categories.error;

  // Pricing is optional everywhere. The same parser runs on the server, so a form that
  // passes here cannot be rejected later for a different reason.
  const pricing = parsePricingInput({
    pricingModel: value(form, "pricingModel"),
    startingPrice: value(form, "startingPrice"),
    pricingCurrency: value(form, "pricingCurrency"),
    pricingBasis: value(form, "pricingBasis"),
    pricingUnit: value(form, "pricingUnit"),
    pricingPerSeat: form.get("pricingPerSeat") === "on",
  });
  if (!pricing.ok && isSubmissionField(pricing.field)) errors[pricing.field] = pricing.error;

  const email = value(form, "contactEmail");
  if (!EMAIL.test(email) || email.length > 320) errors.contactEmail = "Enter a valid private contact email.";
  const social = parseXHandleInput(value(form, "founderSocialHandle"));
  if (!social.ok) errors.founderSocialHandle = social.error;

  const logos = form.getAll("logo").filter((entry): entry is File => entry instanceof File && entry.size > 0);
  if (logos.length > 1) errors.logo = "Choose one logo only.";
  else if (logos[0]) {
    const error = logoFileError(logos[0]);
    if (error) errors.logo = error;
  }

  const screenshots = form.getAll("screenshots").filter((entry): entry is File => entry instanceof File && entry.size > 0);
  const screenshotsError = screenshotFilesError(screenshots);
  if (screenshotsError) errors.screenshots = screenshotsError;

  if (form.get("ownershipConsent") !== "on") errors.ownershipConsent = "Confirm that you built this product or are authorized to submit it.";
  return errors;
}

export function isSubmissionField(value: unknown): value is SubmissionField {
  return typeof value === "string" && (SUBMISSION_FIELDS as readonly string[]).includes(value);
}

/** The subset of validateSubmissionForm that belongs to one step. */
export function validateSubmissionStep(form: FormData, step: SubmissionStep, options: { draft?: boolean } = {}): SubmissionFieldErrors {
  const all = validateSubmissionForm(form, options);
  const owned = new Set<string>(SUBMISSION_STEPS[step]);
  const errors: SubmissionFieldErrors = {};
  for (const [field, message] of Object.entries(all)) {
    if (owned.has(field)) errors[field as SubmissionField] = message;
  }
  return errors;
}
