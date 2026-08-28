import "server-only";
import { fetchPinnedPublic } from "./submission-metadata";
import { validPublicHostname } from "./integration-validation";

const VERIFY_HTML_MAX_BYTES = 256_000;
const VERIFY_TEXT_MAX_BYTES = 16_384;

function normalizedHost(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, "");
}

function verifiedTarget(rawUrl: string): URL {
  const url = new URL(rawUrl);
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") throw new Error("HTTPS_REQUIRED");
  if (!["http:", "https:"].includes(url.protocol) || !validPublicHostname(url.hostname)) throw new Error("INVALID_TARGET");
  return url;
}

export async function fetchPinnedHttpsText(hostname: string, path: string, maxBytes = VERIFY_TEXT_MAX_BYTES): Promise<string> {
  const host = normalizedHost(hostname);
  if (!validPublicHostname(host) || !path.startsWith("/") || !/^[\x20-\x7e]+$/.test(path)) throw new Error("INVALID_TARGET");
  const result = await fetchPinnedPublic(`https://${host}${path}`, "text/plain", maxBytes, 3, host);
  if (!/^(text\/plain|application\/octet-stream)\b/.test(result.contentType)) throw new Error("INVALID_CONTENT_TYPE");
  return result.bytes.toString("utf8");
}

export async function fetchPinnedVerificationHtml(rawUrl: string): Promise<{ html: string; finalUrl: string }> {
  const target = verifiedTarget(rawUrl);
  const result = await fetchPinnedPublic(target.toString(), "text/html,application/xhtml+xml", VERIFY_HTML_MAX_BYTES, 3, target.hostname);
  if (!/^(text\/html|application\/xhtml\+xml)\b/.test(result.contentType)) throw new Error("INVALID_CONTENT_TYPE");
  return { html: result.bytes.toString("utf8"), finalUrl: result.url };
}
