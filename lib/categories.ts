export const FOUNDERTRAIL_CATEGORIES = [
  { slug: "ai-tools", name: "AI tools" },
  { slug: "productivity", name: "Productivity" },
  { slug: "developer-tools", name: "Developer tools" },
  { slug: "marketing-seo", name: "Marketing & SEO" },
  { slug: "sales-crm", name: "Sales & CRM" },
  { slug: "design-creative", name: "Design & creative" },
  { slug: "writing-content", name: "Writing & content" },
  { slug: "analytics-data", name: "Analytics & data" },
  { slug: "finance-accounting", name: "Finance & accounting" },
  { slug: "ecommerce", name: "E-commerce" },
  { slug: "education", name: "Education" },
  { slug: "health-fitness", name: "Health & fitness" },
  { slug: "travel", name: "Travel" },
  { slug: "games", name: "Games" },
  { slug: "directories-discovery", name: "Directories & discovery" },
  { slug: "advertising-sponsorship", name: "Advertising & sponsorship" },
  { slug: "other", name: "Other" },
] as const;

export const FOUNDERTRAIL_CATEGORY_SLUGS = FOUNDERTRAIL_CATEGORIES.map((category) => category.slug);

export function isFounderTrailCategorySlug(value: string): boolean {
  return (FOUNDERTRAIL_CATEGORY_SLUGS as readonly string[]).includes(value);
}
