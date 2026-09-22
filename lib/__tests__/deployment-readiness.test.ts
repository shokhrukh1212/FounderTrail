import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { validateProductSubmission } from "../product-validation";

const submissionRoute=readFileSync(new URL("../../app/api/products/route.ts",import.meta.url),"utf8");
const productData=readFileSync(new URL("../product-data.ts",import.meta.url),"utf8");
const adminRoute=readFileSync(new URL("../../app/api/admin/products/[slug]/status/route.ts",import.meta.url),"utf8");
const evidenceRoute=readFileSync(new URL("../../app/api/admin/evidence/[id]/route.ts",import.meta.url),"utf8");
const publicLogoRoute=readFileSync(new URL("../../app/api/products/[slug]/logo/route.ts",import.meta.url),"utf8");
const productLogo=readFileSync(new URL("../../components/ProductLogo.tsx",import.meta.url),"utf8");
const ownerRecoveryRoute=readFileSync(new URL("../../app/api/admin/products/[slug]/owner-link/route.ts",import.meta.url),"utf8");
const integrationManager=readFileSync(new URL("../../components/IntegrationManager.tsx",import.meta.url),"utf8");
const migration=readFileSync(new URL("../../migrations/004_submission_simplification.up.sql",import.meta.url),"utf8");

function minimalForm(){const form=new FormData();for(const [key,value] of Object.entries({websiteUrl:"https://manual.example",name:"Manual",tagline:"A manually entered product",contactEmail:"private@example.com",categories:"productivity",ownershipConsent:"on"}))form.set(key,value);return form;}

test("manual submission works without extraction or founder fields",()=>{
  const result=validateProductSubmission(minimalForm());assert.equal(result.ok,true);
  if(result.ok){assert.equal(result.value.metadataToken,null);assert.equal(result.value.founderName,null);assert.equal(result.value.founderSocialHandle,null);}
});

test("contact email is private and pending products stay out of public DTOs",()=>{
  const publicSection=productData.slice(0,productData.indexOf("export type ManagedProduct"));
  assert.doesNotMatch(publicSection,/contact_email|contactEmail/);
  assert.match(productData,/p\.status = 'published'/);
  assert.match(submissionRoute,/requestedStatus/);
  assert.match(submissionRoute,/launch_date, status/);
  assert.match(submissionRoute,/applyProductCategories/);
  assert.match(submissionRoute,/validated\.value\.categorySlugs/);
});

test("production excludes demo data from public discovery and actions",()=>{
  assert.match(productData,/NODE_ENV === "production" \? `p\.is_demo = false`/);
  assert.match(productData,/\$\d::boolean OR NOT p\.is_demo/);
  assert.match(migration,/products_demo_idx|is_demo|products_published_domain_unique_idx/);
});

test("launching today uses the submitted UTC launch date",()=>{
  assert.match(productData,/p\.launch_date = \(now\(\) AT TIME ZONE 'UTC'\)::date/);
});

test("admin owns category assignment and duplicate-domain override",()=>{
  assert.match(adminRoute,/InvalidCategorySelection/);assert.match(adminRoute,/DUPLICATE_DOMAIN/);assert.match(adminRoute,/overrideDuplicate/);
  assert.match(adminRoute,/applyProductCategories\(client, product\.id, categorySlugs, "admin"\)/);
});

test("public evidence requires admin acceptance before an aggregate is written",()=>{
  assert.match(evidenceRoute,/body\.status==="accepted"/);assert.match(evidenceRoute,/'publicly_sourced'/);assert.match(evidenceRoute,/Number\.isSafeInteger|\^\\d\+\$/);
  assert.match(migration,/status IN \('pending','accepted','rejected'\)/);
});

test("approved duplicate domains use a deliberate partial-index escape hatch",()=>{
  assert.match(migration,/UNIQUE INDEX products_published_domain_unique_idx/);assert.match(migration,/status = 'published' AND NOT domain_override_approved/);
});

test("published listings safely proxy extracted logos when no stored logo exists",()=>{
  assert.match(productData,/\/api\/products\/.*\/logo/);
  assert.match(publicLogoRoute,/p\.status = 'published'/);
  assert.match(publicLogoRoute,/fetchPinnedPublic/);
  assert.match(publicLogoRoute,/validatePublicLogo/);
  assert.match(publicLogoRoute,/content-security-policy/);
  assert.match(publicLogoRoute,/fetchSubmissionMetadata\(product\.website_url\)/);
  assert.match(submissionRoute,/verifyMetadata[\s\S]*\?\? await fetchSubmissionMetadata/);
  assert.match(productLogo,/faviconUrl\(productUrl\)/);
  assert.match(productLogo,/failedSources/);
});

test("admins can replace a lost owner link without recovering the stored hash",()=>{
  assert.match(ownerRecoveryRoute,/validAdminRequest/);
  assert.match(ownerRecoveryRoute,/requestOriginIsSameSite/);
  assert.match(ownerRecoveryRoute,/newBidIndexOwnerToken/);
  assert.match(ownerRecoveryRoute,/token_version=token_version\+1/);
  assert.match(ownerRecoveryRoute,/cache-control.*no-store/);
  assert.doesNotMatch(ownerRecoveryRoute,/SELECT[^;]*token_hash/i);
});

test("owner integration setup explains verification and copies every integration value",()=>{
  assert.match(integrationManager,/\.well-known\/bidindex-verification\.txt/);
  assert.match(integrationManager,/navigator\.clipboard\.writeText/);
  assert.match(integrationManager,/bidindex-verification/);
  assert.match(integrationManager,/Verification URL/);
  assert.match(integrationManager,/File contents/);
  assert.match(integrationManager,/Check verification/);
  assert.match(integrationManager,/Check installation/);
  assert.match(integrationManager,/\["light", "dark", "compact"\]/);
  assert.match(integrationManager,/api\/partner\/v1\/events/);
  assert.match(integrationManager,/Domain verification and the badge activate this optional site tracker/);
});

test("legal pages are linked from every page and share the prose styling",()=>{
  const layout=readFileSync(new URL("../../app/layout.tsx",import.meta.url),"utf8");
  assert.match(layout,/<Link href="\/privacy">Privacy policy<\/Link>/);
  assert.match(layout,/<Link href="\/terms">Terms of service<\/Link>/);
  for(const page of ["privacy","terms"]){
    const source=readFileSync(new URL(`../../app/${page}/page.tsx`,import.meta.url),"utf8");
    assert.match(source,/className="app-shell prose-page legal-page"/);
    assert.match(source,/<LegalContact topic=/);
  }
  const privacy=readFileSync(new URL("../../app/privacy/page.tsx",import.meta.url),"utf8");
  assert.match(privacy,/Google API Services User Data Policy/);
  assert.match(readFileSync(new URL("../../app/privacy-policy/page.tsx",import.meta.url),"utf8"),/permanentRedirect\("\/privacy"\)/);
  assert.match(readFileSync(new URL("../../app/terms-of-service/page.tsx",import.meta.url),"utf8"),/permanentRedirect\("\/terms"\)/);
});

test("CLI deploys never upload env files or database backups",()=>{
  const ignored=readFileSync(new URL("../../.vercelignore",import.meta.url),"utf8").split("\n").map(line=>line.trim());
  for(const entry of [".env*","backups/"])assert.ok(ignored.includes(entry),`${entry} must be in .vercelignore`);
});
