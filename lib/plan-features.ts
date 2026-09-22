/**
 * What each FounderTrail plan includes. The pricing page and the per-startup upgrade page
 * both render from this list, so the two can never describe Pro differently.
 */
export type PlanFeature = { title: string; description?: string };

export const FREE_PLAN_FEATURES: readonly PlanFeature[] = [
  { title: "Public startup page" },
  { title: "Normal launch scheduling" },
  { title: "Community upvotes, discussion, and follows" },
  { title: "Founder updates and basic statistics" },
  { title: "Screenshots and ordinary website links" },
];

export const PRO_PLAN_FEATURES: readonly PlanFeature[] = [
  { title: "Editable launch graphics", description: "professional layouts, ready to download." },
  { title: "Editable social posts", description: "adapt and copy drafts for your launch." },
  { title: "Seven-day results summary", description: "understand activity around your startup." },
  { title: "Pro badge", description: "visible beside your startup's name." },
];

export const PRO_INTRO_SLOTS = 20;

export function introPriceLine(introAvailable: number): string {
  return introAvailable > 0 ? `First ${PRO_INTRO_SLOTS} startup purchases: $5. Then $9.` : "The $5 introductory offer has ended.";
}
