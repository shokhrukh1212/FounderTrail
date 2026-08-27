import { randomUUID } from "node:crypto";
import { eventHash } from "./request-security";
import { visitorIdFromRequest as legacyVisitorIdFromRequest } from "./visitor-id";

export const BIDINDEX_VISITOR_COOKIE = "bidindex_visitor";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function bidIndexVisitorIdFromRequest(request: Request): string | null {
  const cookie = request.headers.get("cookie") ?? "";
  for (const part of cookie.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name !== BIDINDEX_VISITOR_COOKIE) continue;
    const value = decodeURIComponent(rest.join("="));
    if (UUID.test(value)) return value;
  }
  return legacyVisitorIdFromRequest(request);
}

export function ensureBidIndexVisitor(request: Request): { id: string; hash: string; isNew: boolean } {
  const existing = bidIndexVisitorIdFromRequest(request);
  const id = existing ?? randomUUID();
  return { id, hash: eventHash("bidindex:visitor", id), isNew: !existing };
}

export const bidIndexVisitorCookieOptions = {
  httpOnly: true,
  maxAge: 60 * 60 * 24 * 365,
  path: "/",
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};
