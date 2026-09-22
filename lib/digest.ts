import { createHmac, timingSafeEqual } from "node:crypto";
import { config } from "./config";

function signature(userId: string): string {
  return createHmac("sha256", config.eventHashSalt).update(`foundertrail:digest-unsubscribe\0${userId}`).digest("base64url");
}

export function digestUnsubscribeToken(userId: string): string {
  const payload = Buffer.from(userId, "utf8").toString("base64url");
  return `${payload}.${signature(userId)}`;
}

export function readDigestUnsubscribeToken(token: string): string | null {
  if (token.length > 512) return null;
  const [payload, supplied, ...extra] = token.split(".");
  if (extra.length || !payload || !supplied) return null;
  try {
    const userId = Buffer.from(payload, "base64url").toString("utf8");
    const expected = signature(userId);
    return expected.length === supplied.length && timingSafeEqual(Buffer.from(expected), Buffer.from(supplied)) ? userId : null;
  } catch { return null; }
}
