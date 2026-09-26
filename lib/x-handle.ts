/**
 * Founder X handles. Letters, numbers and underscores fit both a real handle and a
 * name typed without spaces ("alexsmith"), so a format check alone cannot tell them
 * apart. The input therefore has to say it is a handle: start with @ or paste the
 * x.com / twitter.com profile link. Stored values are always "@handle".
 */
const HANDLE = /^[A-Za-z0-9_]{1,15}$/;
const PROFILE_URL = /^(?:https?:\/\/)?(?:www\.|mobile\.)?(?:x|twitter)\.com\/([^/?#\s]+)\/?(?:[?#].*)?$/i;
// X paths that look like handles but are pages, not profiles.
const RESERVED = new Set(["home", "i", "intent", "share", "search", "explore", "settings", "messages", "notifications", "login", "logout", "signup", "compose", "hashtag", "tos", "privacy"]);

export const X_HANDLE_ERROR = "Enter your X handle starting with @, such as @alexsmith, or paste your x.com profile link. Not your name.";

export type XHandleResult = { ok: true; handle: string | null } | { ok: false; error: string };

export function parseXHandleInput(raw: unknown): XHandleResult {
  const input = typeof raw === "string" ? raw.trim() : "";
  if (!input) return { ok: true, handle: null };
  const candidate = input.startsWith("@") ? input.slice(1) : PROFILE_URL.exec(input)?.[1];
  if (candidate === undefined || !HANDLE.test(candidate) || RESERVED.has(candidate.toLowerCase())) return { ok: false, error: X_HANDLE_ERROR };
  return { ok: true, handle: `@${candidate}` };
}

export type XHandleStatus = "valid" | "invalid" | "missing";

/** Classifies a stored value. Rows saved before validation existed can hold names. */
export function storedXHandleStatus(value: string | null | undefined): XHandleStatus {
  const stored = value?.trim() ?? "";
  if (!stored) return "missing";
  return /^@[A-Za-z0-9_]{1,15}$/.test(stored) && !RESERVED.has(stored.slice(1).toLowerCase()) ? "valid" : "invalid";
}
