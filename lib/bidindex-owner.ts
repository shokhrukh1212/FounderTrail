import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const TOKEN = /^[a-f0-9]{64}$/;

export function newBidIndexOwnerToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashBidIndexOwnerToken(token: string): string {
  return createHash("sha256").update(`bidindex-owner:${token}`).digest("hex");
}

export function ownerCookieName(productId: string): string {
  return `bidindex_owner_${productId.replace(/-/g, "")}`;
}

export function ownerTokenFromRequest(request: Request, productId: string): string | null {
  const expectedName = ownerCookieName(productId);
  for (const part of (request.headers.get("cookie") ?? "").split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name !== expectedName) continue;
    const token = decodeURIComponent(rest.join("="));
    return TOKEN.test(token) ? token : null;
  }
  return null;
}

export function tokenHashMatches(expected: string | null, token: string | null): boolean {
  if (!expected || !token || !TOKEN.test(token)) return false;
  const received = hashBidIndexOwnerToken(token);
  return expected.length === received.length && timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}

export const ownerCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 365 * 2,
};
