import { createHmac, timingSafeEqual } from "node:crypto";

type ApprovalAccess = { productId: string; approvedAt: Date; tokenVersion: number };

function signature(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(`bidindex:approval-access\0${payload}`).digest("base64url");
}

export function approvalAccessToken(input: ApprovalAccess, secret: string): string {
  const payload = Buffer.from(JSON.stringify({ p: input.productId, a: input.approvedAt.toISOString(), v: input.tokenVersion }), "utf8").toString("base64url");
  return `v1.${payload}.${signature(payload, secret)}`;
}

export function approvalAccessMatches(token: string | null, expected: ApprovalAccess, secret: string): boolean {
  if (!token || !secret || token.length > 512) return false;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v1" || !/^[A-Za-z0-9_-]+$/.test(parts[1]) || !/^[A-Za-z0-9_-]{43}$/.test(parts[2])) return false;
  const expectedSignature = signature(parts[1], secret);
  if (expectedSignature.length !== parts[2].length || !timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(parts[2]))) return false;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as { p?: unknown; a?: unknown; v?: unknown };
    return payload.p === expected.productId
      && payload.a === expected.approvedAt.toISOString()
      && payload.v === expected.tokenVersion;
  } catch {
    return false;
  }
}

export function approvalManagementUrl(siteUrl: string, slug: string, token: string): string {
  return `${siteUrl.replace(/\/+$/, "")}/manage/${encodeURIComponent(slug)}#approval=${encodeURIComponent(token)}`;
}
