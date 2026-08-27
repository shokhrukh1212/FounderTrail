import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { config } from "./config";

export function newIntegrationSecret(): string { return `bis_${randomBytes(32).toString("base64url")}`; }
export function newVerificationToken(): string { return `bidindex_${randomBytes(16).toString("hex")}`; }
export function hashIntegrationSecret(secret: string): string {
  return createHmac("sha256", config.eventHashSalt).update(`integration-secret\0${secret}`).digest("hex");
}
export function integrationSecretMatches(expected: string, secret: string): boolean {
  if (!/^bis_[A-Za-z0-9_-]{40,60}$/.test(secret)) return false;
  const actual = hashIntegrationSecret(secret);
  return expected.length === actual.length && timingSafeEqual(Buffer.from(expected), Buffer.from(actual));
}
export function bearerSecret(request: Request): string | null {
  const match = /^Bearer ([A-Za-z0-9_-]+)$/.exec(request.headers.get("authorization") ?? "");
  return match?.[1] ?? null;
}
