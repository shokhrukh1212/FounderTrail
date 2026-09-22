import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { extractSubmissionMetadata, googleFaviconUrl, isPublicAddress, largestIcoPng, pinnedLookup, METADATA_MAX_BYTES, METADATA_MAX_REDIRECTS, METADATA_TIMEOUT_MS, PUBLIC_LOGO_ACCEPT, signMetadata, validatePublicLogo, verifyMetadata } from "../submission-metadata";

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

/** A minimal PNG whose header declares the given size; enough for the ICO directory. */
function png(size:number):Buffer{const bytes=Buffer.alloc(33);Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]).copy(bytes);bytes.writeUInt32BE(size,16);bytes.writeUInt32BE(size,20);return bytes;}
function ico(entries:Array<{size:number;image:Buffer}>):Buffer{
  const header=Buffer.alloc(6+entries.length*16);header.writeUInt16LE(0,0);header.writeUInt16LE(1,2);header.writeUInt16LE(entries.length,4);
  let offset=header.length;
  entries.forEach((entry,index)=>{const at=6+index*16;header[at]=entry.size%256;header[at+1]=entry.size%256;header.writeUInt32LE(entry.image.length,at+8);header.writeUInt32LE(offset,at+12);offset+=entry.image.length;});
  return Buffer.concat([header,...entries.map(entry=>entry.image)]);
}

test("a favicon.ico becomes its largest embedded PNG",()=>{
  const icon=ico([{size:16,image:png(16)},{size:48,image:png(48)},{size:32,image:png(32)}]);
  assert.equal(largestIcoPng(icon)?.readUInt32BE(16),48);
  for(const type of ["image/x-icon","image/vnd.microsoft.icon"]){const logo=validatePublicLogo(icon,type);assert.equal(logo.contentType,"image/png");assert.equal(logo.bytes.readUInt32BE(16),48);}
  // Legacy bitmap-only icons, and icon bytes served under another type, are still refused.
  assert.throws(()=>validatePublicLogo(ico([{size:32,image:Buffer.alloc(40)}]),"image/x-icon"),/INVALID_LOGO/);
  assert.throws(()=>validatePublicLogo(icon,"image/png"),/INVALID_LOGO/);
  assert.equal(largestIcoPng(Buffer.from("not an icon")),null);
  assert.match(PUBLIC_LOGO_ACCEPT,/image\/x-icon/);
  assert.equal(googleFaviconUrl("https://www.keephimwalking.com/path"),"https://www.google.com/s2/favicons?domain=www.keephimwalking.com&sz=256");
});

test("the sharpest declared site icon is chosen, and a legacy .ico comes last",()=>{
  const pick=(links:string)=>extractSubmissionMetadata(`<title>T</title>${links}`,"https://example.com").logoUrl;
  assert.equal(pick(`<link rel="icon" href="/favicon.ico"><link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png">`),"https://example.com/icon-192.png");
  assert.equal(pick(`<link rel="icon" href="/favicon.ico" type="image/x-icon"><link rel="icon" href="/icon.svg" type="image/svg+xml">`),"https://example.com/icon.svg");
  assert.equal(pick(`<link rel="icon" type="image/png" sizes="32x32" href="/32.png"><link rel="apple-touch-icon" href="/touch.png">`),"https://example.com/touch.png");
  assert.equal(pick(`<link rel="icon" href="/favicon.ico">`),"https://example.com/favicon.ico");
});

test("the pinned DNS lookup answers both the single and the all-addresses form",()=>{
  const lookup=pinnedLookup({address:"93.184.216.34",family:4}) as unknown as (host:string,options:{all?:boolean},callback:(error:unknown,address:unknown,family?:number)=>void)=>void;
  lookup("example.com",{all:true},(error,address)=>{assert.equal(error,null);assert.deepEqual(address,[{address:"93.184.216.34",family:4}]);});
  lookup("example.com",{},(error,address,family)=>{assert.equal(error,null);assert.equal(address,"93.184.216.34");assert.equal(family,4);});
});
