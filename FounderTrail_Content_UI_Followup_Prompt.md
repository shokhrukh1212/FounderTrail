# FounderTrail — content and product UI follow-up

Implement this after the existing Pro Launch work is complete. Read the repository instructions and inspect the current components, schemas, migrations, admin editors, comment queries, pricing logic, and product-page Share on X handler first. Work with the existing stack and design system. Make the changes below, rather than rebuilding the app.

Preserve the completed Pro Launch implementation: $5 for the first 20 startup purchases, then $9; the Pro badge, launch assets, reports, payments, and entitlements. Keep sponsorships disabled. Do not change emails or the Pro launch-image/social-text editor. Preserve product IDs, URLs, slugs, ownership, votes, follows, comments, click history, and analytics. Only categories have an explicitly requested reset, described below.

## 1. Clean, consistent product rows

Apply the same row structure to homepage launch lists, community favourites, and the discovery directory:

- Left: logo, short product name, existing Pro badge when eligible, one-line description, and category chips.
- Right: upvote button with its real count, comment icon with its real count, and Follow/Following.
- Remove the Visit website action and outbound-click count from these rows. Under the description, show categories only; remove pricing pills from these rows too. Keep click tracking and existing detail-page/dashboard statistics.
- The logo and name link to the internal product page. Do not wrap the entire row around nested buttons or links. Category chips open the matching directory filter.
- Show a small right-arrow next to the name on name-link hover and keyboard focus. Reserve its space to avoid layout jumps. Touch users must still have a clear tappable name without hovering. Do not use an external-link icon for this internal navigation.
- Put the compact green Pro badge immediately after the name. Its accessible label/tooltip must explain that it is the paid Pro plan, not identity or revenue verification. Avoid duplicating the existing badge logic.
- The comments control links directly to the product's discussion section and opens that section if tabs hide it. Scrolling must account for the sticky header. It works when the count is zero and does not require sign-in just to read.
- Count visible, published comments and replies consistently with the discussion itself. Exclude deleted, hidden, spam, or pending items. Load counts efficiently for a page of products, without one query per row. Use real counts, never placeholder values.
- Preserve the existing sign-in requirement for upvotes, following, and posting comments. Keep ranking rules unchanged.
- On narrow screens, allow the action group and category chips to wrap neatly. Use accessible labels, clear focus states, sufficient touch targets, and no horizontal overflow. Keep rows compact and easy to scan.

The detail page keeps its prominent tracked Visit website button.

## 2. Categories: one to three, selected by people

Use this fixed initial taxonomy. These are FounderTrail's product categories, not an exact copy of another directory.

| Label | Stable slug | Scope |
| --- | --- | --- |
| AI & Assistants | ai-assistants | General AI assistants, agents, and AI platforms. |
| Developer Tools | developer-tools | Coding, APIs, testing, infrastructure, and developer utilities. |
| No-Code & Automation | no-code-automation | Visual builders and workflow automation. |
| Productivity | productivity | Notes, tasks, calendars, focus, and collaboration. |
| Design & Creative | design-creative | Visual design, prototyping, graphics, and creative assets. |
| Writing & Content | writing-content | Writing, editing, publishing, and content management. |
| Video & Audio | video-audio | Video, podcasts, music, recording, and media editing. |
| Marketing & SEO | marketing-seo | Advertising, email marketing, SEO, and audience growth. |
| Sales & CRM | sales-crm | Leads, outreach, sales pipelines, and customer relationships. |
| Customer Support | customer-support | Help desks, support chat, customer feedback, and service tools. |
| Analytics & Data | analytics-data | Reporting, data collection, analysis, and visualization. |
| Finance & Accounting | finance-accounting | Payments, billing, bookkeeping, budgeting, and financial tools. |
| E-commerce & Retail | ecommerce-retail | Online stores, retail operations, and shopping tools. |
| HR & Recruiting | hr-recruiting | Hiring, job search, people management, and employee tools. |
| Business Operations | business-operations | Contracts, administration, inventory, and operational workflows. |
| Cybersecurity & Privacy | cybersecurity-privacy | Security, identity, privacy, and data protection. |
| Education & Learning | education-learning | Courses, tutoring, study, and skill development. |
| Health & Wellness | health-wellness | Fitness, wellbeing, and health-related products. |
| Social & Community | social-community | Communities, social networks, messaging, and events. |
| Games & Entertainment | games-entertainment | Games, interactive experiences, and entertainment. |
| Travel & Lifestyle | travel-lifestyle | Travel, hobbies, home, family, and everyday consumer services. |
| Marketplaces & Directories | marketplaces-directories | Listings, discovery platforms, and marketplaces connecting buyers and sellers. |
| Hardware & IoT | hardware-iot | Physical technology products and connected devices. |
| Other | other | Products without an appropriate category above. |

Requirements:

- Founders select one primary category and optionally two additional categories. Validate 1–3 unique categories on the server and in the UI. Drafts may remain incomplete.
- Use a searchable selector with removable chips, a “Choose up to 3 categories” hint, and a selected count. Selecting Other makes it the only category; selecting a specific category replaces Other.
- Choose categories based on the product's main function. An AI writing tool can select Writing & Content plus AI & Assistants; an incidental AI feature does not justify every product getting the AI category. Do not introduce SaaS, Free, Paid, or Open source as categories.
- Reuse these categories everywhere: submission, founder editing, admin editing, product pages, list chips, search, and directory filters. Forms must offer the complete taxonomy even when every current product is Other.
- Directory category matching must use any selected category, combined with other filters. Deduplicate products and counts. Keep pagination and filter URLs working.
- Give admins a practical searchable product list, an “Other / needs classification” filter, and the same 1–3 category editor. Do not build a new taxonomy-management application.

**Explicit one-time migration:** Archive every existing product's old category assignments, then set all products existing at migration time to Other, as requested. Use a versioned, transactional migration with a fixed target set and recorded completion. Running it again must not reset manual categorization or newly submitted products. Record affected IDs and before/after counts. Provide a recovery procedure that does not overwrite later edits. Do not delete products or unrelated metadata. Disable automated category assignment/overwrites; I will categorize existing products through admin, and future founders will choose their categories.

## 3. Short names and product-page Share on X

Separate brand name from marketing text in the public UI. Examples: “AgentHill”, “BidPixel”, “YourHour”, and “SaaS Town”; their slogans belong in the description.

- Reuse a suitable existing short-name field, or add an optional editable display-name field. Label new submissions “Product name” with the hint “Your product's name only; put its tagline below.” Let authorized founders and admins correct existing names.
- Preserve original stored names and existing slugs. Do not blindly split all names on hyphens, punctuation, or spaces: real brand names can contain them. Existing ambiguous names require review. Only populate short names automatically from an already trustworthy structured brand-name field; otherwise provide admin correction.
- Use the short display name in list titles, the detail-page title, and product-page sharing. Prefer the simple section heading “Overview” over repeating a long name in “What [name] helps you do”.
- Safely decode encoded text such as `&#x27;` for public descriptions and share text, then render it as text. Do not inject untrusted HTML. Preserve legitimate Unicode, apostrophes, ampersands, and brand punctuation.
- Audit all product-page Share on X buttons and make their draft exactly:

  `Discover {shortProductName} on FounderTrail.`

  followed by the canonical public FounderTrail product-page URL.

- Do not add the slogan, description, metrics, hashtags, or claims that the sharing visitor is the founder. Do not use localhost URLs in production shares.
- Use X's supported web intent with correctly encoded text and URL parameters, including the link once. Open the composer so the user can edit before posting. Do not auto-post or add X API credentials. Keep a normal-link fallback and useful mobile behavior.
- Keep this change isolated from email subjects, email templates, and the Pro social-post editor, even if they currently share a helper. Document any legacy names still needing admin correction.

## 4. Optional, founder-entered product pricing

This is the listed startup's pricing, not FounderTrail's Free/Pro checkout.

- Make pricing optional in submission and founder/admin editing. No inferred price is publicly authoritative.
- Offer pricing models: Free, Freemium, Paid, Contact sales. Provide a clear way to leave pricing blank or clear it later.
- For Freemium or Paid, allow an optional starting amount, currency, and billing basis: one-time, monthly, yearly, or usage-based. If an amount is supplied, require the relevant currency and billing basis; usage-based amounts also need a unit. Support per-seat qualifiers where applicable. Reject inconsistent or negative values without losing the draft.
- Examples: “Free”; “Freemium · Paid plans from USD 9/month”; “Paid · From USD 29 one-time”; “Contact sales”. If only a model is entered, show only that model. Do not make up an amount.
- Open source is a separate characteristic, not a pricing model: open-source products can charge for hosting or services. Preserve any existing open-source information separately.
- If no founder/admin pricing information exists, omit the public pricing row/badge entirely. Do not display “Unknown”, “Not listed”, or “See website” as pricing. The detail-page Visit website action remains available.
- Keep legacy inferred pricing privately for review, but stop displaying it unless an admin or authorized founder confirms it. Preserve explicitly confirmed values. Record who last supplied/confirmed pricing and when; later enrichment must not overwrite it.
- Do not scrape or guess a price into a submitted listing, convert annual prices into monthly claims, or prefill example amounts as actual values. Clearing pricing removes its public display without removing the product.

## 5. Verify and hand over

Use focused checks covering category limits/Other exclusivity, migration reruns preserving manual edits, hidden-comment exclusion, discussion deep links, share URL encoding, omitted pricing, and unchanged historical totals. Check the actual homepage, directory, and detail page at desktop and mobile sizes. Exercise the existing upvote/follow behavior and verify that Pro badges still use real entitlements.

Finish with a concise report: changes made, checks passed, exact migration/setup commands, and how I edit short names, categories, and pricing in admin. Identify anything you could not verify. Do not deploy automatically. Complete the implementation rather than stopping after a plan.

Research references for implementation context:

- Product Hunt supports up to three categories: https://help.producthunt.com/en/articles/8104478-how-to-add-a-category-to-a-product
- Product Hunt's category directory: https://www.producthunt.com/categories
- G2's functionality-based classification and product-name guidance: https://research.g2.com/methodology/categorization
- X Web Intents: https://docs.x.com/x-for-websites/web-intents/overview
