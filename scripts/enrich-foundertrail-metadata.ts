import { getPool } from "../lib/db";
import { fetchPinnedPublic } from "../lib/submission-metadata";
import { FOUNDERTRAIL_CATEGORY_SLUGS } from "../lib/categories";

type Product = { id: string; slug: string; name: string; tagline: string; description: string | null; use_case: string | null; website_url: string; pricing_model: string | null; category_slug: string | null; category_provenance: string | null; pricing_provenance: string | null };
type Pricing = { model: "free" | "freemium" | "paid" | "open_source" | "contact" | "unknown"; startingMinor: number | null; currency: string | null; evidenceUrl: string; reason: string; confidence: "high" | "medium" | "low" };
type Category = { slug: string; reason: string; confidence: "high" | "medium" | "low" };

const apply = process.argv.includes("--apply");
const limitArg = process.argv.find((value) => value.startsWith("--limit="));
const limit = limitArg ? Math.max(1, Number.parseInt(limitArg.split("=")[1] ?? "", 10) || 1) : 500;
const version = "foundertrail-public-metadata-v1";

function entities(value: string): string {
  return value.replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#0?39;/gi, "'").replace(/&nbsp;/gi, " ").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">");
}

function visibleText(html: string): string {
  return entities(html.replace(/<script\b[\s\S]*?<\/script>/gi, " ").replace(/<style\b[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim().slice(0, 250_000);
}

function attr(tag: string, name: string): string | null {
  const found = tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return entities(found?.[1] ?? found?.[2] ?? found?.[3] ?? "").trim() || null;
}

function normalizedHost(value: string): string {
  return new URL(value).hostname.toLowerCase().replace(/^www\./, "");
}

function pricingLink(html: string, pageUrl: string): string | null {
  const host = normalizedHost(pageUrl);
  for (const tag of html.match(/<a\b[^>]*>/gi) ?? []) {
    const href = attr(tag, "href");
    if (!href) continue;
    try {
      const target = new URL(href, pageUrl);
      if (normalizedHost(target.toString()) === host && /\/(?:pricing|plans|membership|upgrade)(?:\/|$|\?)/i.test(`${target.pathname}${target.search}`)) return target.toString();
    } catch {}
  }
  return null;
}

function classifyPricing(text: string, evidenceUrl: string, dedicated: boolean): Pricing {
  const lower = text.toLowerCase();
  const openSource = /\bopen[ -]source\b|\bmit license\b|\bapache license\b/.test(lower);
  const free = /\bfree forever\b|\bfree plan\b|\bfree tier\b|\bcompletely free\b|\bstart for free\b|\blaunch free\b|\bplay for free\b|\bno cost\b|\bfree to use\b/.test(lower);
  const contact = /\bcontact sales\b|\btalk to sales\b|\brequest (?:a )?demo\b/.test(lower);
  const priceMatches = [...text.matchAll(/(?:(US\$|CA\$|AU\$|€|£|\$)\s?)(\d{1,7}(?:[.,]\d{1,2})?)/g)];
  const recurring = /\bper (?:month|year)\b|\/(?:mo|month|yr|year)\b|\bmonthly\b|\bannual(?:ly)?\b|\bone[- ]time payment\b|\bcosts?\s+(?:US\$|CA\$|AU\$|€|£|\$)/i.test(text);
  const paid = priceMatches.length > 0 && (dedicated || recurring);
  let model: Pricing["model"] = "unknown";
  if (openSource && !paid) model = "open_source";
  else if (free && paid) model = "freemium";
  else if (paid) model = "paid";
  else if (free) model = "free";
  else if (contact) model = "contact";
  const currencyMap: Record<string, string> = { "$": "USD", "US$": "USD", "CA$": "CAD", "AU$": "AUD", "€": "EUR", "£": "GBP" };
  const prices = priceMatches.map((match) => ({ minor: Math.round(Number(match[2].replace(",", ".")) * 100), currency: currencyMap[match[1]] })).filter((item) => Number.isSafeInteger(item.minor) && item.minor > 0);
  const first = prices.sort((a, b) => a.minor - b.minor)[0];
  const starting = model === "paid" || model === "freemium" ? first ?? null : null;
  const signals = [openSource ? "open-source wording" : "", free ? "free-plan wording" : "", paid ? "published price" : "", contact ? "sales-contact wording" : ""].filter(Boolean).join(" and ");
  return { model, startingMinor: starting?.minor ?? null, currency: starting?.currency ?? null, evidenceUrl, reason: signals ? `Official product page contains ${signals}.` : "No reliable pricing signal was found on the accessible official pages.", confidence: model === "unknown" ? "low" : dedicated ? "high" : "medium" };
}

function classifyCategory(product: Product, siteText: string): Category {
  const savedText = `${product.name} ${product.tagline} ${product.description ?? ""} ${product.use_case ?? ""}`.toLowerCase();
  const rules: Array<[string, RegExp, string]> = [
    ["finance-accounting", /\b(invoice|invoicing|accounting|bookkeeping|finance tool|expense|budgeting)\b/, "Product evidence describes finance or accounting work."],
    ["games", /\b(game|gaming|puzzle|wordle|trivia|quiz|play to|players?)\b/, "Product evidence describes a game or puzzle."],
    ["advertising-sponsorship", /\b(advertis(?:e|ing)|sponsor(?:ship|ed)?|billboard|bid to rank|pay[- ]to[- ]rank|promotional marketplace|buy (?:a )?(?:link|placement|floor)|one product per floor|brand placement)\b/, "Product evidence describes advertising, sponsorship, or paid placement."],
    ["directories-discovery", /\b(directory|directories|product discovery|discover (?:saas|startups|products)|launch directory|startup listing)\b/, "Product evidence describes a directory or discovery service."],
    ["developer-tools", /\b(developer tool|devtool|api|sdk|deployment|deploy|code review|database|uptime|outage|status page)\b/, "Product evidence describes a developer or infrastructure tool."],
    ["marketing-seo", /\b(seo|backlink|keyword|content marketing|email marketing|social media marketing)\b/, "Product evidence describes marketing or SEO work."],
    ["sales-crm", /\b(crm|sales pipeline|lead generation|prospecting|sales team)\b/, "Product evidence describes sales or CRM work."],
    ["design-creative", /\b(design tool|graphic design|image editor|remove background|illustration|creative tool)\b/, "Product evidence describes design or creative work."],
    ["writing-content", /\b(writing tool|copywriting|grammar|blog writer|content creation)\b/, "Product evidence describes writing or content work."],
    ["analytics-data", /\b(analytics|data visualization|dashboard|business intelligence|monitoring)\b/, "Product evidence describes analytics or data work."],
    ["ecommerce", /\b(e-?commerce|online store|shopify|shopping cart|marketplace for (?:buyers|sellers))\b/, "Product evidence describes e-commerce."],
    ["education", /\b(education|learning platform|course|students|teachers|study tool)\b/, "Product evidence describes education or learning."],
    ["health-fitness", /\b(health|fitness|workout|wellness|medical)\b/, "Product evidence describes health or fitness."],
    ["travel", /\b(travel|trip planner|flight|hotel|tourism)\b/, "Product evidence describes travel."],
    ["ai-tools", /\b(ai tool|artificial intelligence|generative ai|gpt|llm)\b/, "Product evidence identifies AI as the main product capability."],
    ["productivity", /\b(productivity|task manager|to-do|workflow|calendar|focus tool|note taking)\b/, "Product evidence describes productivity work."],
  ];
  for (const [slug, pattern, reason] of rules) if (pattern.test(savedText)) return { slug, reason: `${reason} The match is in the saved founder description.`, confidence: "high" };
  const publicText = siteText.slice(0, 8_000).toLowerCase();
  for (const [slug, pattern, reason] of rules) if (pattern.test(publicText)) return { slug, reason: `${reason} The match is only on the official public website and needs review.`, confidence: "medium" };
  return { slug: "other", reason: "Available product evidence does not support a more specific category.", confidence: "low" };
}

async function fetchEvidence(product: Product): Promise<{ text: string; pricing: Pricing }> {
  try {
    const home = await fetchPinnedPublic(product.website_url, "text/html,application/xhtml+xml", 600_000, 3);
    if (!/text\/html|application\/xhtml\+xml/.test(home.contentType)) throw new Error("NOT_HTML");
    const html = home.bytes.toString("utf8");
    const link = pricingLink(html, home.url);
    if (link) {
      try {
        const page = await fetchPinnedPublic(link, "text/html,application/xhtml+xml", 600_000, 2, new URL(home.url).hostname);
        const text = visibleText(page.bytes.toString("utf8"));
        return { text: `${visibleText(html)} ${text}`, pricing: classifyPricing(text, page.url, true) };
      } catch {}
    }
    const text = visibleText(html);
    return { text, pricing: classifyPricing(text, home.url, false) };
  } catch {
    return { text: "", pricing: { model: "unknown", startingMinor: null, currency: null, evidenceUrl: product.website_url, reason: "The official website was not accessible to the safe metadata reader.", confidence: "low" } };
  }
}

async function main() {
const pool = getPool();
try {
  const products = await pool.query<Product>(`SELECT p.id::text,p.slug,p.name,p.tagline,p.description,p.use_case,p.website_url,p.pricing_model,
      c.slug AS category_slug,p.category_provenance,p.pricing_provenance
    FROM products p LEFT JOIN categories c ON c.id=p.primary_category_id
    WHERE p.status='published' AND NOT p.is_demo ORDER BY p.created_at,p.id LIMIT $1`, [limit]);
  const results: Array<{ product: Product; category: Category; pricing: Pricing }> = [];
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(6, products.rows.length) }, async () => {
    while (cursor < products.rows.length) {
      const product = products.rows[cursor++];
      const evidence = await fetchEvidence(product);
      results.push({ product, category: classifyCategory(product, evidence.text), pricing: evidence.pricing });
    }
  }));
  results.sort((a, b) => a.product.slug.localeCompare(b.product.slug));
  const counts = (values: string[]) => values.reduce<Record<string, number>>((summary, value) => {
    summary[value] = (summary[value] ?? 0) + 1;
    return summary;
  }, {});
  console.log(JSON.stringify({
    mode: apply ? "apply" : "dry-run",
    version,
    total: results.length,
    proposedCategories: counts(results.map((item) => item.category.slug)),
    proposedPricing: counts(results.map((item) => item.pricing.model)),
    products: results.map(({ product, category, pricing }) => ({
      id: product.id,
      slug: product.slug,
      currentCategory: product.category_slug,
      proposedCategory: category.slug,
      categoryConfidence: category.confidence,
      proposedPricing: pricing.model,
      pricingConfidence: pricing.confidence,
      evidenceUrl: pricing.evidenceUrl,
    })),
  }, null, 2));

  if (apply) {
    if (process.env.CONFIRM_METADATA_ENRICHMENT !== version) throw new Error(`Set CONFIRM_METADATA_ENRICHMENT=${version} to apply after reviewing the dry run.`);
    await pool.query("BEGIN");
    try {
      for (const { product, category, pricing } of results) {
        if (!(FOUNDERTRAIL_CATEGORY_SLUGS as readonly string[]).includes(category.slug)) continue;
        const categoryRow = await pool.query<{ id: string }>(`SELECT id::text FROM categories WHERE slug=$1`, [category.slug]);
        const categoryId = categoryRow.rows[0]?.id;
        const canClassify = !product.category_provenance || product.category_provenance === "foundertrail-category-v1-review";
        if (categoryId && canClassify) {
          await pool.query(`INSERT INTO product_classification_audits(product_id,classification_kind,old_value,proposed_value,evidence_url,reason,confidence,review_state,classification_version,applied_at)
            VALUES($1::uuid,'category',$2,$3,$4,$5,$6,$7,$8,CASE WHEN $7='applied' THEN now() END)
            ON CONFLICT(product_id,classification_kind,classification_version) DO NOTHING`, [product.id, product.category_slug, category.slug, product.website_url, category.reason, category.confidence, category.confidence === "high" ? "applied" : "needs_review", version]);
          if (category.confidence === "high") {
            await pool.query(`UPDATE products SET primary_category_id=$2::bigint,category_review_required=false,category_provenance=$3,updated_at=now() WHERE id=$1::uuid`, [product.id, categoryId, version]);
            await pool.query(`DELETE FROM product_categories WHERE product_id=$1::uuid AND position=0`, [product.id]);
            await pool.query(`INSERT INTO product_categories(product_id,category_id,position) VALUES($1::uuid,$2::bigint,0) ON CONFLICT(product_id,category_id) DO UPDATE SET position=0`, [product.id, categoryId]);
            await pool.query(`UPDATE product_classification_audits SET review_state='rejected' WHERE product_id=$1::uuid AND classification_kind='category' AND review_state='needs_review' AND classification_version<>$2`, [product.id, version]);
          }
        }
        const canPrice = !product.pricing_provenance && (!product.pricing_model || product.pricing_model === "unknown");
        const pricingState = pricing.model !== "unknown" ? "applied" : "needs_review";
        await pool.query(`INSERT INTO product_classification_audits(product_id,classification_kind,old_value,proposed_value,evidence_url,reason,confidence,review_state,classification_version,applied_at)
          VALUES($1::uuid,'pricing',$2,$3,$4,$5,$6,$7,$8,CASE WHEN $7='applied' THEN now() END)
          ON CONFLICT(product_id,classification_kind,classification_version) DO NOTHING`, [product.id, product.pricing_model, pricing.model, pricing.evidenceUrl, pricing.reason, pricing.confidence, pricingState, version]);
        if (canPrice && pricing.model !== "unknown") await pool.query(`UPDATE products SET pricing_model=$2,starting_price_minor=$3,pricing_currency=$4,pricing_evidence_url=$5,pricing_checked_at=now(),pricing_provenance=$6,updated_at=now() WHERE id=$1::uuid`, [product.id, pricing.model, pricing.startingMinor, pricing.currency, pricing.evidenceUrl, version]);
      }
      await pool.query("COMMIT");
    } catch (error) {
      await pool.query("ROLLBACK");
      throw error;
    }
  }
} finally {
  await pool.end();
}
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Metadata enrichment failed.");
  process.exit(1);
});
