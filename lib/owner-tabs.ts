/**
 * The owner workspace's single row of tabs. Kept outside the client dashboard component
 * so the server page can read it too — values exported from a "use client" module are
 * only client references on the server.
 */
export const OWNER_TABS = [
  { id: "overview", label: "Overview" },
  { id: "updates", label: "Updates" },
  { id: "verification", label: "Verification" },
  { id: "settings", label: "Settings" },
  { id: "launch-kit", label: "Launch kit" },
  { id: "results", label: "Results" },
] as const;

export type OwnerTab = (typeof OWNER_TABS)[number]["id"];

export function isOwnerTab(value: unknown): value is OwnerTab {
  return OWNER_TABS.some((item) => item.id === value);
}

export function ownerTabHref(slug: string, tab: OwnerTab): string {
  return tab === "overview" ? `/manage/${slug}` : `/manage/${slug}?tab=${tab}`;
}
