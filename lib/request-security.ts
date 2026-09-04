import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { config } from "./config";

export function eventHash(context: string, value: string): string {
  if (process.env.NODE_ENV === "production" && !process.env.EVENT_HASH_SALT && !process.env.IP_HASH_SALT) {
    throw new Error("EVENT_HASH_SALT must be configured in production");
  }
  return createHmac("sha256", config.eventHashSalt)
    .update(`${context}\0${value}`)
    .digest("hex");
}

export function requestIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for") ?? "";
  return forwarded.split(",")[0].trim() || request.headers.get("x-real-ip") || "unknown";
}

export function networkHash(request: Request, context: string): string {
  const userAgent = (request.headers.get("user-agent") ?? "unknown").trim().slice(0, 500);
  return eventHash(`${context}:network`, `${requestIp(request)}\n${userAgent}`);
}

export function truncatedNetwork(request: Request): string {
  const ip = requestIp(request).toLowerCase();
  if (isIP(ip) === 4) {
    const parts = ip.split(".");
    return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
  }
  if (isIP(ip) === 6) return `${ip.split(":").slice(0, 3).join(":")}::/48`;
  return "unknown";
}

/**
 * Abuse bucket for votes. `networkHash` mixes in the full user-agent, which the caller
 * writes itself, so editing one character of it minted a fresh rate-limit bucket. This
 * keys on the address block alone, which a sender cannot rewrite in a header.
 */
export function networkBlockHash(request: Request, context: string): string {
  return eventHash(`${context}:network-block`, truncatedNetwork(request));
}

function userAgentCategory(request: Request): string {
  const ua = (request.headers.get("user-agent") ?? "").toLowerCase();
  const device = /bot|crawler|spider/.test(ua) ? "bot" : /mobile|android|iphone/.test(ua) ? "mobile" : "desktop";
  const browser = /firefox\//.test(ua) ? "firefox" : /edg\//.test(ua) ? "edge" : /chrome\//.test(ua) ? "chrome" : /safari\//.test(ua) ? "safari" : "other";
  return `${device}:${browser}`;
}

/** Daily, project-scoped estimate. Raw addresses and full user agents never leave request memory. */
export function dailyVisitorHash(request: Request, projectId: string, utcDate: string): string {
  const dailySalt = eventHash("partner-visitor-daily-salt", utcDate);
  return createHmac("sha256", dailySalt)
    .update(`${projectId}\0${utcDate}\0${truncatedNetwork(request)}\0${userAgentCategory(request)}`)
    .digest("hex");
}

export function requestOriginIsSameSite(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return process.env.NODE_ENV !== "production";
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}
