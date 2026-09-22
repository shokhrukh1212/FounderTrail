import { isIP } from "node:net";
import { normalizeCategorySelection } from "./categories";
import { parsePricingInput, type ProductPricing } from "./product-pricing";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PRIVATE_HOSTS = new Set(["localhost", "0.0.0.0", "::", "::1"]);

export type ProductSubmission = {
  websiteUrl: string;
  normalizedDomain: string;
  name: string;
  tagline: string;
  founderName: string | null;
  contactEmail: string;
  founderSocialHandle: string | null;
  /** One to three taxonomy slugs, primary first. Empty only for an incomplete draft. */
  categorySlugs: string[];
  launchDate: string;
  launchAt: Date;
  consentVersion: string;
  metadataToken: string | null;
  useCase: string | null;
  intendedAudience: string | null;
  pricing: ProductPricing;
  isOpenSource: boolean;
};

export type ValidationResult = { ok: true; value: ProductSubmission } | { ok: false; error: string; field?: string };

function text(form: FormData, name: string, max: number): string {
  const value = String(form.get(name) ?? "").trim();
  return value.length <= max ? value : "";
}

function isPrivateIpv4(host: string): boolean {
  const parts = host.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  return parts[0] === 10 || parts[0] === 127 || parts[0] === 0
    || (parts[0] === 169 && parts[1] === 254)
    || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
    || (parts[0] === 192 && parts[1] === 168)
    || parts[0] >= 224;
}

function isPrivateIpv6(host: string): boolean {
  const clean = host.replace(/^\[|\]$/g, "").toLowerCase();
  return clean === "::" || clean === "::1" || clean.startsWith("fc") || clean.startsWith("fd")
    || /^fe[89ab]/.test(clean) || clean.startsWith("::ffff:127.") || clean.startsWith("::ffff:10.")
    || clean.startsWith("::ffff:192.168.");
}

export function publicHttpUrl(raw: string): { ok: true; url: string; domain: string } | { ok: false; error: string } {
  let candidate = raw.trim();
  if (!/^https?:\/\//i.test(candidate)) candidate = `https://${candidate}`;
  let parsed: URL;
  try { parsed = new URL(candidate); } catch { return { ok: false, error: "Enter a valid public HTTP(S) URL." }; }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
    return { ok: false, error: "Enter a valid public HTTP(S) URL." };
  }
  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  if (!host || PRIVATE_HOSTS.has(host) || host.endsWith(".localhost") || !host.includes(".")) {
    return { ok: false, error: "Enter a public website URL." };
  }
  const ipVersion = isIP(host.replace(/^\[|\]$/g, ""));
  if ((ipVersion === 4 && isPrivateIpv4(host)) || (ipVersion === 6 && isPrivateIpv6(host))) {
    return { ok: false, error: "Private network URLs are not allowed." };
  }
  parsed.hash = "";
  return { ok: true, url: parsed.toString(), domain: host };
}

export function validateProductSubmission(form: FormData, options: { draft?: boolean } = {}): ValidationResult {
  const website = publicHttpUrl(text(form, "websiteUrl", 2048));
  if (!website.ok) return { ok: false, error: website.error, field: "websiteUrl" };
  const required: Array<[keyof ProductSubmission, string, number]> = [
    ["name", "name", 80], ["tagline", "tagline", 160], ["contactEmail", "contactEmail", 320],
  ];
  const values: Record<string, string> = {};
  for (const [, field, max] of required) {
    const value = text(form, field, max);
    if (!value) return { ok: false, error: "This field is required and must fit the stated limit.", field };
    values[field] = value;
  }
  if (!EMAIL.test(values.contactEmail)) return { ok: false, error: "Enter a valid contact email.", field: "contactEmail" };
  const categories = normalizeCategorySelection(text(form, "categories", 400), { allowEmpty: options.draft });
  if (!categories.ok) return { ok: false, error: categories.error, field: "categories" };
  const launchDate = new Date().toISOString().slice(0, 10);
  const launchAt = new Date(`${launchDate}T12:00:00.000Z`);
  if (form.get("ownershipConsent") !== "on") return { ok: false, error: "Confirm that you are authorized to submit this product.", field: "ownershipConsent" };
  const founderName = text(form, "founderName", 120);
  const social = text(form, "founderSocialHandle", 120).replace(/^https?:\/\/(?:www\.)?(?:x\.com|twitter\.com)\//i, "").replace(/^@/, "").replace(/\/$/, "");
  if (social && !/^[A-Za-z0-9_]{1,15}$/.test(social)) return { ok: false, error: "Enter an X handle such as @founder.", field: "founderSocialHandle" };
  // Pricing is optional. Nothing here infers a price from the website.
  const pricing = parsePricingInput({
    pricingModel: text(form, "pricingModel", 20),
    startingPrice: text(form, "startingPrice", 20),
    pricingCurrency: text(form, "pricingCurrency", 3),
    pricingBasis: text(form, "pricingBasis", 20),
    pricingUnit: text(form, "pricingUnit", 60),
    pricingPerSeat: form.get("pricingPerSeat") === "on",
  });
  if (!pricing.ok) return { ok: false, error: pricing.error, field: pricing.field };
  return { ok: true, value: {
    websiteUrl: website.url, normalizedDomain: website.domain,
    name: values.name, tagline: values.tagline,
    founderName: founderName || null, contactEmail: values.contactEmail.toLowerCase(),
    founderSocialHandle: social ? `@${social}` : null, categorySlugs: categories.slugs, launchDate, launchAt,
    consentVersion: "2026-08-27", metadataToken: text(form, "metadataToken", 8192) || null,
    useCase:text(form,"useCase",500)||null,intendedAudience:text(form,"intendedAudience",500)||null,
    pricing: pricing.value, isOpenSource: form.get("isOpenSource") === "on",
  } };
}
