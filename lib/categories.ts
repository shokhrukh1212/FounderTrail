/**
 * FounderTrail's product taxonomy. These are our own categories, grouped by what a
 * product does, not a copy of another directory's list. Slugs are the stable identity:
 * they appear in directory filter URLs and in every form payload, so a label can be
 * reworded without breaking a saved link or an existing assignment.
 */
export const FOUNDERTRAIL_CATEGORIES = [
  { slug: "ai-assistants", name: "AI & Assistants", scope: "General AI assistants, agents, and AI platforms." },
  { slug: "developer-tools", name: "Developer Tools", scope: "Coding, APIs, testing, infrastructure, and developer utilities." },
  { slug: "no-code-automation", name: "No-Code & Automation", scope: "Visual builders and workflow automation." },
  { slug: "productivity", name: "Productivity", scope: "Notes, tasks, calendars, focus, and collaboration." },
  { slug: "design-creative", name: "Design & Creative", scope: "Visual design, prototyping, graphics, and creative assets." },
  { slug: "writing-content", name: "Writing & Content", scope: "Writing, editing, publishing, and content management." },
  { slug: "video-audio", name: "Video & Audio", scope: "Video, podcasts, music, recording, and media editing." },
  { slug: "marketing-seo", name: "Marketing & SEO", scope: "Advertising, email marketing, SEO, and audience growth." },
  { slug: "sales-crm", name: "Sales & CRM", scope: "Leads, outreach, sales pipelines, and customer relationships." },
  { slug: "customer-support", name: "Customer Support", scope: "Help desks, support chat, customer feedback, and service tools." },
  { slug: "analytics-data", name: "Analytics & Data", scope: "Reporting, data collection, analysis, and visualization." },
  { slug: "finance-accounting", name: "Finance & Accounting", scope: "Payments, billing, bookkeeping, budgeting, and financial tools." },
  { slug: "ecommerce-retail", name: "E-commerce & Retail", scope: "Online stores, retail operations, and shopping tools." },
  { slug: "hr-recruiting", name: "HR & Recruiting", scope: "Hiring, job search, people management, and employee tools." },
  { slug: "business-operations", name: "Business Operations", scope: "Contracts, administration, inventory, and operational workflows." },
  { slug: "cybersecurity-privacy", name: "Cybersecurity & Privacy", scope: "Security, identity, privacy, and data protection." },
  { slug: "education-learning", name: "Education & Learning", scope: "Courses, tutoring, study, and skill development." },
  { slug: "health-wellness", name: "Health & Wellness", scope: "Fitness, wellbeing, and health-related products." },
  { slug: "social-community", name: "Social & Community", scope: "Communities, social networks, messaging, and events." },
  { slug: "games-entertainment", name: "Games & Entertainment", scope: "Games, interactive experiences, and entertainment." },
  { slug: "travel-lifestyle", name: "Travel & Lifestyle", scope: "Travel, hobbies, home, family, and everyday consumer services." },
  { slug: "marketplaces-directories", name: "Marketplaces & Directories", scope: "Listings, discovery platforms, and marketplaces connecting buyers and sellers." },
  { slug: "hardware-iot", name: "Hardware & IoT", scope: "Physical technology products and connected devices." },
  { slug: "other", name: "Other", scope: "Products without an appropriate category above." },
] as const;

export type FounderTrailCategory = (typeof FOUNDERTRAIL_CATEGORIES)[number];

export const OTHER_CATEGORY_SLUG = "other";
export const MAX_PRODUCT_CATEGORIES = 3;

export const FOUNDERTRAIL_CATEGORY_SLUGS = FOUNDERTRAIL_CATEGORIES.map((category) => category.slug);

const BY_SLUG = new Map(FOUNDERTRAIL_CATEGORIES.map((category) => [category.slug as string, category]));

export function isFounderTrailCategorySlug(value: unknown): value is FounderTrailCategory["slug"] {
  return typeof value === "string" && BY_SLUG.has(value);
}

export function categoryName(slug: string): string | null {
  return BY_SLUG.get(slug)?.name ?? null;
}

export type CategorySelection =
  | { ok: true; slugs: string[] }
  | { ok: false; error: string };

/**
 * The one place the 1-3 rule and Other's exclusivity are decided. The form, the
 * submission API, founder editing and admin editing all call this, so a selection that
 * the UI accepts is exactly the selection the server accepts.
 *
 * `allowEmpty` exists for drafts, which are allowed to stay incomplete.
 */
export function normalizeCategorySelection(input: unknown, options: { allowEmpty?: boolean } = {}): CategorySelection {
  const raw = Array.isArray(input)
    ? input
    : typeof input === "string" ? input.split(",") : [];
  const slugs: string[] = [];
  for (const entry of raw) {
    const slug = typeof entry === "string" ? entry.trim() : "";
    if (!slug) continue;
    if (!isFounderTrailCategorySlug(slug)) return { ok: false, error: "Choose categories from the FounderTrail list." };
    if (!slugs.includes(slug)) slugs.push(slug);
  }
  if (!slugs.length) {
    return options.allowEmpty ? { ok: true, slugs: [] } : { ok: false, error: "Choose at least one category." };
  }
  if (slugs.length > MAX_PRODUCT_CATEGORIES) return { ok: false, error: `Choose up to ${MAX_PRODUCT_CATEGORIES} categories.` };
  if (slugs.includes(OTHER_CATEGORY_SLUG) && slugs.length > 1) {
    return { ok: false, error: "Other cannot be combined with another category." };
  }
  return { ok: true, slugs };
}

/**
 * What the picker does when a chip is added: Other is a statement that nothing else
 * fits, so it replaces the rest and any specific category replaces it.
 */
export function toggleCategorySelection(current: readonly string[], slug: string): string[] {
  if (!isFounderTrailCategorySlug(slug)) return [...current];
  if (current.includes(slug)) return current.filter((item) => item !== slug);
  if (slug === OTHER_CATEGORY_SLUG) return [OTHER_CATEGORY_SLUG];
  const withoutOther = current.filter((item) => item !== OTHER_CATEGORY_SLUG);
  if (withoutOther.length >= MAX_PRODUCT_CATEGORIES) return withoutOther;
  return [...withoutOther, slug];
}

/** Directory filter link for a category chip. */
export function categoryFilterHref(slug: string): string {
  return `/?view=discover&category=${encodeURIComponent(slug)}#products`;
}
