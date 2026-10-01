# SEO deployment

Public pages declare their own canonical and Open Graph URL. The root layout shares
branding and images without declaring a homepage canonical for every child route.
Discovery and updates views, including pagination, have distinct canonicals. Tracking
parameters are omitted. Search, filters, and alternate ordering use `noindex, follow`;
admin, management, and launch workspaces use `noindex`. Published product URLs remain
unchanged. The sitemap includes the public views, informational pages, and published
non-demo products.

## Publish this change

From the repository root, using the existing Vercel project:

```sh
printf '%s' 'https://bidindex.dev' | npx vercel env add SITE_URL production --force --yes
git push origin main
npx vercel --prod
npm run seo:check -- https://bidindex.dev
```

If this checkout is not linked, first run `npx vercel link` and select the existing
project serving bidindex.dev. The environment update affects the next deployment;
deploy after setting it. Git push may also trigger an automatic deployment if Vercel's
Git integration is enabled. The CLI production deployment explicitly publishes the
current checkout with the updated production environment.

This SEO change requires no database migration or data reset. Do not upload a local
environment file wholesale: its localhost SITE_URL belongs only to development.

The read-only smoke check verifies public HTTP responses, canonical URLs, indexing
directives, robots.txt, sitemap origins, one published product when available, and
directory pagination when there are more than 24 published products. It repeats with
a browser user agent and AhrefsBot's user agent. It cannot establish whether a firewall
admits Ahrefs' real crawler IPs; inspect Vercel Firewall logs if actual crawl failures
remain.

## After deployment

- Submit `https://bidindex.dev/sitemap.xml` in Google Search Console and inspect the
  homepage, About, Pricing, and one published product. Confirm that the fetched HTML
  uses the expected canonical before requesting indexing.
- Compare Ahrefs' followed referring domains and lost backlinks around September
  21–October 1. Inspect each lost link's referring page, attribute changes, target
  response, and lost reason. This is still needed to identify the DR drop.
- Recheck DR after Ahrefs updates its crawl data. Fixing canonical and crawling issues
  does not promise recovery of an external backlink metric.

References: [Next.js metadata merging](https://nextjs.org/docs/app/api-reference/functions/generate-metadata#merging),
[Google pagination guidance](https://developers.google.com/search/docs/specialty/ecommerce/pagination-and-incremental-page-loading),
[Ahrefs DR drop reasons](https://help.ahrefs.com/en/articles/2061537-why-has-there-been-a-drop-in-my-domain-rating-dr-recently-did-your-crawl-algorithm-change).
