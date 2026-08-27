import { createHmac } from "node:crypto";
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

export function requestOriginIsSameSite(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return process.env.NODE_ENV !== "production";
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}
