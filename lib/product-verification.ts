export type VerificationMethod = "meta" | "file";

function attribute(tag: string, name: string): string | null {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return (match?.[1] ?? match?.[2] ?? match?.[3] ?? "").trim() || null;
}

export function containsVerificationMeta(html: string, token: string): boolean {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    if (attribute(tag, "name")?.toLowerCase() === "bidindex-verification" && attribute(tag, "content") === token) return true;
  }
  return false;
}

export function containsBadgeInstallation(html: string, projectId: string, siteUrl: string): boolean {
  const expected = new URL("/embed/badge.js", siteUrl);
  for (const tag of html.match(/<script\b[^>]*>/gi) ?? []) {
    if (attribute(tag, "data-project") !== projectId) continue;
    const rawSource = attribute(tag, "src");
    if (!rawSource) continue;
    try {
      const source = new URL(rawSource, siteUrl);
      if (source.origin === expected.origin && source.pathname === expected.pathname) return true;
    } catch { /* Ignore malformed script URLs. */ }
  }
  return false;
}

export function productVerificationTimestamp(domainVerifiedAt: Date | null, badgeInstalledAt: Date | null, current: Date | null, now = new Date()): Date | null {
  if (current) return current;
  return domainVerifiedAt && badgeInstalledAt ? now : null;
}
