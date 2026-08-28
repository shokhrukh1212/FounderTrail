export const SUBMISSION_FIELDS = [
  "websiteUrl",
  "name",
  "tagline",
  "launchDate",
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

function validDate(raw: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return false;
  const parsed = new Date(`${raw}T12:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === raw;
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

export function validateSubmissionForm(form: FormData): SubmissionFieldErrors {
  const errors: SubmissionFieldErrors = {};
  const website = value(form, "websiteUrl");
  const websiteError = websiteFieldError(website);
  if (websiteError) errors.websiteUrl = websiteError;

  const name = value(form, "name");
  if (!name || name.length > 80) errors.name = "Enter a product name using 80 characters or fewer.";
  const tagline = value(form, "tagline");
  if (!tagline || tagline.length > 160) errors.tagline = "Add a one-line description using 160 characters or fewer.";
  if (!validDate(value(form, "launchDate"))) errors.launchDate = "Choose a valid launch date.";

  const email = value(form, "contactEmail");
  if (!EMAIL.test(email) || email.length > 320) errors.contactEmail = "Enter a valid private contact email.";
  const social = value(form, "founderSocialHandle").replace(/^https?:\/\/(?:www\.)?(?:x\.com|twitter\.com)\//i, "").replace(/^@/, "").replace(/\/$/, "");
  if (social && !/^[A-Za-z0-9_]{1,15}$/.test(social)) errors.founderSocialHandle = "Use an X handle such as @alexsmith (letters, numbers and underscores only).";

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
