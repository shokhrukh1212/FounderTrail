import assert from "node:assert/strict";

// Read-only deployment smoke check. No credentials or database access required.
const origin = new URL(process.argv[2] || "https://bidindex.dev").origin;
const agents = [
  ["browser", "Mozilla/5.0 (compatible; FounderTrailSEOCheck/1.0)"],
  ["AhrefsBot", "Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)"],
];

function attributes(tag) {
  return Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g)]
    .map(([, key, value]) => [key.toLowerCase(), value.replaceAll("&amp;", "&")]));
}

async function request(path, agent) {
  const response = await fetch(new URL(path, origin), {
    headers: { "user-agent": agent },
    redirect: "manual",
    signal: AbortSignal.timeout(30_000),
  });
  assert.equal(response.status, 200, `${path}: expected 200, got ${response.status}`);
  return { response, body: await response.text() };
}

function assertIndexable(response, body, path) {
  const directives = [response.headers.get("x-robots-tag") || "",
    ...[...body.matchAll(/<meta\b[^>]*>/gi)].map(([tag]) => attributes(tag))
      .filter((meta) => /^(robots|googlebot|ahrefsbot)$/.test(meta.name || ""))
      .map((meta) => meta.content || "")].join(",");
  assert.doesNotMatch(directives, /\b(noindex|none)\b/i, `${path}: indexing is disabled`);
}

async function main() {
  for (const [name, agent] of agents) {
    const { body: robots } = await request("/robots.txt", agent);
    assert.match(robots, /^Allow:\s*\/\s*$/mi, "robots.txt must allow public crawling");
    assert.doesNotMatch(robots, /^Disallow:\s*\/\s*$/mi, "robots.txt blocks all crawling");
    assert.ok(robots.includes(`Sitemap: ${origin}/sitemap.xml`), "robots.txt sitemap uses the wrong origin");
    const { response: sitemapResponse, body: sitemap } = await request("/sitemap.xml", agent);
    assertIndexable(sitemapResponse, "", "/sitemap.xml");
    const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)]
      .map(([, url]) => url.replaceAll("&amp;", "&"));
    assert.ok(locations.length, "sitemap.xml has no URLs");
    for (const location of locations) {
      assert.equal(new URL(location).origin, origin, `Wrong sitemap origin: ${location}`);
      assert.doesNotMatch(new URL(location).pathname, /^\/(admin|manage|activate|claim|api)(\/|$)/,
        `Private URL in sitemap: ${location}`);
    }
    const paths = ["/", "/about", "/pricing", "/privacy", "/terms", "/?view=discover", "/?view=updates"];
    const products = locations.filter((url) => new URL(url).pathname.startsWith("/product/"));
    if (products.length) paths.push(new URL(products[0]).pathname);
    if (products.length > 24) paths.push("/?view=discover&page=2");
    for (const path of paths) {
      assert.ok(locations.includes(new URL(path, origin).href.replace(/\/$/, ""))
        || locations.includes(new URL(path, origin).href) || path.includes("page="),
      `${path}: missing from sitemap`);
      const { response, body } = await request(path, agent);
      assertIndexable(response, body, path);
      const canonicals = [...body.matchAll(/<link\b[^>]*>/gi)].map(([tag]) => attributes(tag))
        .filter((link) => link.rel === "canonical");
      assert.equal(canonicals.length, 1, `${path}: expected exactly one canonical`);
      assert.equal(canonicals[0].href, new URL(path, origin).href, `${path}: incorrect canonical`);
      console.log(`OK [${name}] ${path}`);
    }
    const { response, body } = await request("/sign-in", agent);
    const robotsTags = [...body.matchAll(/<meta\b[^>]*>/gi)].map(([tag]) => attributes(tag))
      .filter((meta) => meta.name === "robots").map((meta) => meta.content).join(",");
    assert.match(`${robotsTags},${response.headers.get("x-robots-tag") || ""}`, /\bnoindex\b/i,
      "Sign-in page must remain noindex");
    console.log(`OK [${name}] private sign-in noindex; robots and ${locations.length} sitemap URLs`);
  }
  console.log("SEO smoke checks passed. This checks user-agent access, not verified crawler IPs or backlink history.");
}

main().catch((error) => {
  console.error(`SEO check failed: ${error.message}`);
  process.exitCode = 1;
});
