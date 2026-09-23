import { createHmac, timingSafeEqual } from "node:crypto";
import { resolve4, resolve6 } from "node:dns/promises";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import type { LookupAddress, LookupOptions } from "node:dns";
import { BlockList, isIP, type LookupFunction } from "node:net";
import { config } from "./config";
import { hostnameFallback } from "./metadata";
import { publicHttpUrl } from "./product-validation";

export const METADATA_TIMEOUT_MS = 5_000;
export const METADATA_MAX_BYTES = 300_000;
export const METADATA_MAX_REDIRECTS = 3;
export const PUBLIC_LOGO_MAX_BYTES = 512_000;
/** Every image type a website logo may arrive as. Icons are converted to PNG before use. */
export const PUBLIC_LOGO_ACCEPT = "image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon,image/vnd.microsoft.icon";

export type SubmissionMetadata = {
  originalUrl: string;
  finalUrl: string;
  productName: string;
  tagline: string;
  logoUrl: string | null;
  screenshotUrl: string | null;
  status: "success" | "partial" | "failed";
  fetchedAt: string | null;
};

export type ValidatedPublicLogo = {
  bytes: Buffer;
  contentType: "image/png" | "image/jpeg" | "image/webp" | "image/svg+xml";
};

function rasterLogoType(bytes: Uint8Array): ValidatedPublicLogo["contentType"] | null {
  if (bytes.length >= 24 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 12 && String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF" && String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP") return "image/webp";
  return null;
}

/**
 * Validate a remote metadata logo before proxying it from our origin. SVG is
 * permitted only as passive vector markup: scripts, event handlers, embedded
 * documents, entities, and external resource references are rejected.
 */
/**
 * The largest PNG image inside a Windows icon (.ico) file, or null. Many sites publish
 * nothing but /favicon.ico, and modern icon files store each size as an embedded PNG.
 * Legacy bitmap entries are skipped rather than decoded.
 */
export function largestIcoPng(bytes: Buffer): Buffer | null {
  if (bytes.length < 6 || bytes.readUInt16LE(0) !== 0 || bytes.readUInt16LE(2) !== 1) return null;
  const count = bytes.readUInt16LE(4);
  if (!count || 6 + count * 16 > bytes.length) return null;
  let best: { area: number; png: Buffer } | null = null;
  for (let index = 0; index < count; index += 1) {
    const entry = 6 + index * 16;
    const width = bytes[entry] || 256; const height = bytes[entry + 1] || 256;
    const size = bytes.readUInt32LE(entry + 8); const offset = bytes.readUInt32LE(entry + 12);
    if (!size || offset + size > bytes.length) continue;
    const image = bytes.subarray(offset, offset + size);
    if (rasterLogoType(image) !== "image/png") continue;
    if (!best || width * height > best.area) best = { area: width * height, png: Buffer.from(image) };
  }
  return best?.png ?? null;
}

const ICON_TYPES = new Set(["image/x-icon", "image/vnd.microsoft.icon", "image/ico", "image/icon", "application/octet-stream"]);

export function validatePublicLogo(bytes: Buffer, contentType: string): ValidatedPublicLogo {
  if (!bytes.length || bytes.length > PUBLIC_LOGO_MAX_BYTES) throw new Error("INVALID_LOGO");
  const declared = contentType.split(";", 1)[0].trim().toLowerCase();
  if (ICON_TYPES.has(declared) && bytes.length >= 4 && bytes.readUInt32BE(0) === 0x00000100) {
    const png = largestIcoPng(bytes);
    if (!png) throw new Error("INVALID_LOGO");
    return { bytes: png, contentType: "image/png" };
  }
  const raster = rasterLogoType(bytes);
  if (raster) {
    if (declared !== raster) throw new Error("INVALID_LOGO");
    return { bytes, contentType: raster };
  }
  if (declared !== "image/svg+xml") throw new Error("INVALID_LOGO");
  const svg = bytes.toString("utf8");
  if (!/^\s*<svg\b/i.test(svg) || !/<\/svg>\s*$/i.test(svg)) throw new Error("INVALID_LOGO");
  if (/[\u0000]|<\?(?:xml|.*)|<!doctype|<!entity|<\s*(?:script|foreignObject|iframe|object|embed|audio|video|image)\b|\bon[a-z]+\s*=|@import/i.test(svg)) throw new Error("UNSAFE_SVG");
  for (const match of svg.matchAll(/\b(?:href|xlink:href)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)) {
    const value = (match[1] ?? match[2] ?? match[3] ?? "").trim();
    if (!value.startsWith("#")) throw new Error("UNSAFE_SVG");
  }
  for (const match of svg.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/gi)) {
    if (!match[2].trim().startsWith("#")) throw new Error("UNSAFE_SVG");
  }
  return { bytes, contentType: "image/svg+xml" };
}

/** Google's favicon service: a last-resort logo for a site whose own icon links fail. */
export function googleFaviconUrl(websiteUrl: string, size = 256): string | null {
  try { return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(new URL(websiteUrl).hostname)}&sz=${size}`; } catch { return null; }
}

/** The first candidate that downloads and validates as a safe logo, or null. */
export async function fetchPublicLogo(candidates: Array<string | null | undefined>): Promise<ValidatedPublicLogo | null> {
  for (const candidate of new Set(candidates.filter((value): value is string => Boolean(value)))) {
    try {
      const fetched = await fetchPinnedPublic(candidate, PUBLIC_LOGO_ACCEPT, PUBLIC_LOGO_MAX_BYTES, 2);
      return validatePublicLogo(fetched.bytes, fetched.contentType);
    } catch { /* try the next candidate */ }
  }
  return null;
}

const blocked = new BlockList();
for (const [address, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
  ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24],
  ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24],
  ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) blocked.addSubnet(address, prefix, "ipv4");
for (const [address, prefix] of [
  ["::", 128], ["::1", 128], ["fc00::", 7], ["fe80::", 10], ["ff00::", 8],
  ["2001:db8::", 32], ["2001:10::", 28],
] as const) blocked.addSubnet(address, prefix, "ipv6");

export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (!family) return false;
  if (family === 4) return !blocked.check(address, "ipv4");
  const mapped = address.toLowerCase().match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  return mapped ? isPublicAddress(mapped) : !blocked.check(address, "ipv6");
}

async function resolvePublic(hostname: string): Promise<{ address: string; family: 4 | 6 }> {
  const literalFamily = isIP(hostname);
  const addresses = literalFamily
    ? [hostname]
    : [...await resolve4(hostname).catch(() => []), ...await resolve6(hostname).catch(() => [])];
  if (!addresses.length || addresses.some((address) => !isPublicAddress(address))) throw new Error("UNSAFE_TARGET");
  return { address: addresses[0], family: isIP(addresses[0]) as 4 | 6 };
}

/**
 * A DNS lookup that only ever answers with the address already checked as public, so the
 * connection cannot be rebound elsewhere. Node asks for every address (`all: true`) when
 * it races IPv4 and IPv6 ("happy eyeballs", the default since Node 20), and for a single
 * one otherwise; answering in the wrong shape fails every request with ERR_INVALID_IP_ADDRESS.
 */
export function pinnedLookup(pinned: { address: string; family: 4 | 6 }): LookupFunction {
  return ((_hostname: string, options: LookupOptions, callback: (error: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void) => {
    if (options?.all) callback(null, [{ address: pinned.address, family: pinned.family }]);
    else callback(null, pinned.address, pinned.family);
  }) as LookupFunction;
}

type PinnedResponse = { status: number; headers: Record<string, string | string[] | undefined>; bytes: Buffer };
async function pinnedRequest(url: URL, accept: string, maxBytes: number): Promise<PinnedResponse> {
  if ((url.protocol === "https:" && url.port && url.port !== "443") || (url.protocol === "http:" && url.port && url.port !== "80")) throw new Error("UNSAFE_PORT");
  const pinned = await resolvePublic(url.hostname);
  const request = url.protocol === "https:" ? httpsRequest : httpRequest;
  return new Promise((resolve, reject) => {
    const req = request({
      protocol: url.protocol,
      hostname: url.hostname,
      servername: url.protocol === "https:" ? url.hostname : undefined,
      port: url.port || (url.protocol === "https:" ? 443 : 80),
      path: `${url.pathname}${url.search}`,
      method: "GET",
      headers: { accept, "accept-encoding": "identity", "user-agent": `FounderTrail-Metadata/1.0 (+${config.siteUrl}/about)` },
      lookup: pinnedLookup(pinned),
    }, (response) => {
      const declared = Number(response.headers["content-length"] ?? 0);
      if (declared > maxBytes) { response.destroy(new Error("TOO_LARGE")); return; }
      const chunks: Buffer[] = [];
      let total = 0;
      response.on("data", (chunk: Buffer) => {
        total += chunk.length;
        if (total > maxBytes) { req.destroy(new Error("TOO_LARGE")); return; }
        chunks.push(chunk);
      });
      response.on("end", () => resolve({ status: response.statusCode ?? 0, headers: response.headers, bytes: Buffer.concat(chunks) }));
    });
    req.setTimeout(METADATA_TIMEOUT_MS, () => req.destroy(new Error("TIMEOUT")));
    req.on("error", reject);
    req.end();
  });
}

function normalizedRedirectHost(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, "");
}

export async function fetchPinnedPublic(url: string, accept: string, maxBytes: number, redirects = METADATA_MAX_REDIRECTS, allowedRedirectHost?: string): Promise<{ url: string; contentType: string; bytes: Buffer }> {
  const checked = publicHttpUrl(url);
  if (!checked.ok) throw new Error("INVALID_URL");
  let current = new URL(checked.url);
  for (let count = 0; count <= redirects; count += 1) {
    const response = await pinnedRequest(current, accept, maxBytes);
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = Array.isArray(response.headers.location) ? response.headers.location[0] : response.headers.location;
      if (!location || count === redirects) throw new Error("TOO_MANY_REDIRECTS");
      const target = new URL(location, current);
      const rechecked = publicHttpUrl(target.toString());
      if (!rechecked.ok) throw new Error("UNSAFE_REDIRECT");
      if (allowedRedirectHost && normalizedRedirectHost(target.hostname) !== normalizedRedirectHost(allowedRedirectHost)) throw new Error("UNSAFE_REDIRECT");
      current = new URL(rechecked.url);
      continue;
    }
    if (response.status < 200 || response.status >= 300) throw new Error("FETCH_FAILED");
    return { url: current.toString(), contentType: String(response.headers["content-type"] ?? "").toLowerCase(), bytes: response.bytes };
  }
  throw new Error("TOO_MANY_REDIRECTS");
}

function entities(value: string): string {
  return value.replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#0?39;/gi, "'").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/\s+/g, " ").trim();
}
function attr(tag: string, name: string): string | null {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return entities(match?.[1] ?? match?.[2] ?? match?.[3] ?? "") || null;
}
function meta(html: string, key: string): string | null {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    if ((attr(tag, "property") ?? attr(tag, "name"))?.toLowerCase() === key.toLowerCase()) return attr(tag, "content");
  }
  return null;
}
function absoluteHttp(raw: string | null, base: string): string | null {
  if (!raw) return null;
  try { const value = new URL(raw, base); return ["http:", "https:"].includes(value.protocol) ? value.toString() : null; } catch { return null; }
}
function clean(value: string | null, max: number): string {
  return entities((value ?? "").replace(/<[^>]*>/g, "")).slice(0, max).trim();
}

/**
 * Rank a site's declared icons so the sharpest usable one wins: an apple-touch-icon
 * (normally 180px), then the largest declared size, with a vector icon counted as large
 * and a legacy .ico, which is usually 16–48px, tried last.
 */
function iconScore(rel: string[], sizes: string | null, type: string | null, href: string): number {
  const declared = Math.max(0, ...(sizes ?? "").split(/\s+/).map((size) => Number(size.toLowerCase().split("x")[0]) || 0));
  const path = href.toLowerCase().split(/[?#]/, 1)[0];
  if ((type ?? "").includes("svg") || path.endsWith(".svg") || sizes?.toLowerCase() === "any") return 512;
  if (rel.includes("apple-touch-icon")) return Math.max(declared, 180);
  if ((type ?? "").includes("icon") || path.endsWith(".ico")) return Math.min(declared || 16, 48);
  return declared || 32;
}

export function extractSubmissionMetadata(html: string, originalUrl: string, finalUrl = originalUrl): SubmissionMetadata {
  const hostname = new URL(finalUrl).hostname;
  const title = clean(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? null, 80);
  const productName = clean(meta(html, "og:site_name") ?? meta(html, "og:title") ?? title, 80) || hostnameFallback(hostname);
  const tagline = clean(meta(html, "og:description") ?? meta(html, "description"), 160);
  const icons = (html.match(/<link\b[^>]*>/gi) ?? []).flatMap((tag) => {
    const rel = (attr(tag, "rel") ?? "").toLowerCase().split(/\s+/);
    const href = absoluteHttp(attr(tag, "href"), finalUrl);
    if (!href || !(rel.includes("apple-touch-icon") || rel.includes("icon") || rel.includes("shortcut"))) return [];
    return [{ score: iconScore(rel, attr(tag, "sizes"), attr(tag, "type"), href), href }];
  }).sort((a, b) => b.score - a.score);
  return { originalUrl, finalUrl, productName, tagline, logoUrl: icons[0]?.href ?? null, screenshotUrl: absoluteHttp(meta(html, "og:image"), finalUrl), status: "success", fetchedAt: new Date().toISOString() };
}

export async function fetchSubmissionMetadata(rawUrl: string): Promise<SubmissionMetadata> {
  const checked = publicHttpUrl(rawUrl);
  if (!checked.ok) throw new Error("INVALID_URL");
  const fallback: SubmissionMetadata = { originalUrl: checked.url, finalUrl: checked.url, productName: hostnameFallback(checked.domain), tagline: "", logoUrl: null, screenshotUrl: null, status: "failed", fetchedAt: null };
  try {
    const result = await fetchPinnedPublic(checked.url, "text/html,application/xhtml+xml", METADATA_MAX_BYTES);
    if (!/^(text\/html|application\/xhtml\+xml)\b/.test(result.contentType)) throw new Error("NOT_HTML");
    return extractSubmissionMetadata(result.bytes.toString("utf8"), checked.url, result.url);
  } catch { return fallback; }
}

export function signMetadata(metadata: SubmissionMetadata): string {
  const payload = Buffer.from(JSON.stringify({ ...metadata, exp: Date.now() + 30 * 60_000 })).toString("base64url");
  const signature = createHmac("sha256", config.eventHashSalt).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function comparableHostname(value: string): string {
  return new URL(value).hostname.toLowerCase().replace(/^www\./, "");
}

export function verifyMetadata(token: string | null, websiteUrl: string): SubmissionMetadata | null {
  if (!token || token.length > 8192) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = createHmac("sha256", config.eventHashSalt).update(payload).digest();
  let actual: Buffer;
  try { actual = Buffer.from(signature, "base64url"); } catch { return null; }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SubmissionMetadata & { exp: number };
    if (parsed.exp < Date.now() || comparableHostname(parsed.originalUrl) !== comparableHostname(websiteUrl)) return null;
    const { exp: _exp, ...metadata } = parsed; void _exp; return metadata;
  } catch { return null; }
}
