import { isIP } from "node:net";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CURRENCY = /^[A-Z]{3}$/;
const PRIVATE_HOSTS = new Set(["localhost", "0.0.0.0", "::", "::1"]);

export type ProductSubmission = {
  websiteUrl: string;
  normalizedDomain: string;
  name: string;
  tagline: string;
  description: string;
  founderName: string;
  contactEmail: string;
  founderSocialHandle: string | null;
  launchAt: Date;
  categories: string[];
  biddingMechanism: string;
  minimumBidMinor: number | null;
  currentBidMinor: number | null;
  bidCurrency: string | null;
  publicAnalyticsUrl: string | null;
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

function optionalPublicUrl(raw: string): string | null | false {
  if (!raw.trim()) return null;
  const checked = publicHttpUrl(raw);
  return checked.ok ? checked.url : false;
}

function moneyMinor(raw: string): number | null | false {
  const value = raw.trim();
  if (!value) return null;
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) return false;
  const [whole, fraction = ""] = value.split(".");
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(minor) && minor >= 0 ? minor : false;
}

export function validateProductSubmission(form: FormData): ValidationResult {
  const website = publicHttpUrl(text(form, "websiteUrl", 2048));
  if (!website.ok) return { ok: false, error: website.error, field: "websiteUrl" };
  const required: Array<[keyof ProductSubmission, string, number]> = [
    ["name", "name", 80], ["tagline", "tagline", 180], ["description", "description", 5000],
    ["founderName", "founderName", 120], ["contactEmail", "contactEmail", 320],
    ["biddingMechanism", "biddingMechanism", 2000],
  ];
  const values: Record<string, string> = {};
  for (const [, field, max] of required) {
    const value = text(form, field, max);
    if (!value) return { ok: false, error: "This field is required and must fit the stated limit.", field };
    values[field] = value;
  }
  if (!EMAIL.test(values.contactEmail)) return { ok: false, error: "Enter a valid contact email.", field: "contactEmail" };
  const launchDate = text(form, "launchDate", 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(launchDate)) return { ok: false, error: "Choose a valid launch date.", field: "launchDate" };
  const launchAt = new Date(`${launchDate}T12:00:00.000Z`);
  if (Number.isNaN(launchAt.getTime())) return { ok: false, error: "Choose a valid launch date.", field: "launchDate" };
  const categories = [...new Set(form.getAll("categories").map(String).filter((value) => SLUG.test(value)))];
  if (categories.length < 1 || categories.length > 3) return { ok: false, error: "Choose between one and three categories.", field: "categories" };
  const minimumBidMinor = moneyMinor(String(form.get("minimumBid") ?? ""));
  const currentBidMinor = moneyMinor(String(form.get("currentBid") ?? ""));
  if (minimumBidMinor === false || currentBidMinor === false) return { ok: false, error: "Bid values must be positive amounts with at most two decimal places.", field: "minimumBid" };
  const currencyRaw = text(form, "bidCurrency", 3).toUpperCase();
  const bidCurrency = minimumBidMinor !== null || currentBidMinor !== null ? currencyRaw : null;
  if (bidCurrency && !CURRENCY.test(bidCurrency)) return { ok: false, error: "Enter a three-letter currency code.", field: "bidCurrency" };
  const analytics = optionalPublicUrl(String(form.get("publicAnalyticsUrl") ?? ""));
  if (analytics === false) return { ok: false, error: "Enter a valid public analytics URL.", field: "publicAnalyticsUrl" };
  const social = text(form, "founderSocialHandle", 120);
  return { ok: true, value: {
    websiteUrl: website.url, normalizedDomain: website.domain,
    name: values.name, tagline: values.tagline, description: values.description,
    founderName: values.founderName, contactEmail: values.contactEmail.toLowerCase(),
    founderSocialHandle: social || null, launchAt, categories,
    biddingMechanism: values.biddingMechanism, minimumBidMinor, currentBidMinor,
    bidCurrency, publicAnalyticsUrl: analytics,
  } };
}
