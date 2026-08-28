import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { extractSubmissionMetadata, isPublicAddress, METADATA_MAX_BYTES, METADATA_MAX_REDIRECTS, METADATA_TIMEOUT_MS, signMetadata, validatePublicLogo, verifyMetadata } from "../submission-metadata";

test("submission metadata follows documented fallbacks and keeps OG image separate",()=>{
  const full=extractSubmissionMetadata(`<title>HTML title</title><meta name="description" content="Meta description"><meta property="og:title" content="OG title"><meta property="og:site_name" content="Site name"><meta property="og:description" content="OG description"><meta property="og:image" content="/wide.jpg"><link rel="icon" href="/favicon.png"><link rel="apple-touch-icon" href="/touch.png">`,"https://example.com","https://www.example.com/path");
  assert.equal(full.productName,"Site name");assert.equal(full.tagline,"OG description");assert.equal(full.logoUrl,"https://www.example.com/touch.png");assert.equal(full.screenshotUrl,"https://www.example.com/wide.jpg");
  const fallback=extractSubmissionMetadata(`<title>HTML title</title><meta name="description" content="Meta description">`,"https://example.com");
  assert.equal(fallback.productName,"HTML title");assert.equal(fallback.tagline,"Meta description");
});

test("signed metadata remains valid across harmless www normalization",()=>{
  const metadata=extractSubmissionMetadata(`<title>Example</title><link rel="apple-touch-icon" href="/icon.png">`,"https://example.com/","https://www.example.com/");
  const token=signMetadata(metadata);
  assert.equal(verifyMetadata(token,"https://www.example.com/")?.logoUrl,"https://www.example.com/icon.png");
  assert.equal(verifyMetadata(token,"https://attacker.example/"),null);
});

test("SSRF address rules reject private and reserved ranges",()=>{
  for(const address of ["127.0.0.1","10.0.0.1","169.254.169.254","192.168.1.1","100.64.0.1","192.0.2.4","::1","fc00::1","fe80::1","2001:db8::1"])assert.equal(isPublicAddress(address),false,address);
  assert.equal(isPublicAddress("1.1.1.1"),true);
});

test("metadata transport limits and revalidates redirects",()=>{
  assert.equal(METADATA_TIMEOUT_MS,5_000);assert.equal(METADATA_MAX_BYTES,300_000);assert.equal(METADATA_MAX_REDIRECTS,3);
  const source=readFileSync(new URL("../submission-metadata.ts",import.meta.url),"utf8");
  assert.match(source,/resolvePublic\(url\.hostname\)/);assert.match(source,/publicHttpUrl\(target\.toString\(\)\)/);assert.match(source,/accept-encoding.*identity/);assert.match(source,/TOO_LARGE/);
});

test("public logo proxy accepts passive SVG and rejects executable or externally-referenced SVG",()=>{
  const safe=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" fill="#fff"/><path d="M1 1h10"/></svg>`);
  assert.equal(validatePublicLogo(safe,"image/svg+xml; charset=utf-8").contentType,"image/svg+xml");
  for(const unsafe of [
    `<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>`,
    `<svg xmlns="http://www.w3.org/2000/svg"><image href="https://attacker.example/a.png"/></svg>`,
    `<svg xmlns="http://www.w3.org/2000/svg"><rect onload="alert(1)"/></svg>`,
    `<!DOCTYPE svg [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><svg xmlns="http://www.w3.org/2000/svg"></svg>`,
  ]) assert.throws(()=>validatePublicLogo(Buffer.from(unsafe),"image/svg+xml"));
});
